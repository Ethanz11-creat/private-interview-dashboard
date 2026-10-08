"""手撕教学实现：明确接口、稳定计算、可运行的 CPU / GPU 张量运算。

Dependencies: NumPy, PyTorch. 所有函数只做本地计算，不请求模型服务。
"""
import math
from collections import Counter, defaultdict

import numpy as np
import torch
from torch import nn
import torch.nn.functional as F


def sigmoid(x):
    # 稳定分支：避免大负数导致 exp(-x) 溢出；不是 np.where 的双分支同时求值。
    x = np.asarray(x, dtype=np.float64)
    out = np.empty_like(x)
    positive = x >= 0
    out[positive] = 1.0 / (1.0 + np.exp(-x[positive]))
    exp_x = np.exp(x[~positive])
    out[~positive] = exp_x / (1.0 + exp_x)
    return out


def silu(x):
    # SiLU 是 x·sigmoid(x)，不是 sigmoid，也不会把输出限制在 0～1。
    x = np.asarray(x, dtype=np.float64)
    return x * sigmoid(x)


def softmax(x, axis=-1):
    # 一行减自己的最大值，然后除自己的指数和；输入约定为有限 logits。
    x = np.asarray(x, dtype=np.float64)
    shifted = x - x.max(axis=axis, keepdims=True)
    exp_x = np.exp(shifted)
    return exp_x / exp_x.sum(axis=axis, keepdims=True)


class Linear(nn.Module):
    def __init__(self, in_dim, out_dim, bias=True):
        super().__init__()
        # 沿用 nn.Linear 的参数布局与初始化；布局是 API 约定，不是普遍效率定律。
        self.weight = nn.Parameter(torch.empty(out_dim, in_dim))
        self.bias = nn.Parameter(torch.empty(out_dim)) if bias else None
        nn.init.kaiming_uniform_(self.weight, a=math.sqrt(5))
        if self.bias is not None:
            nn.init.uniform_(self.bias, -1 / math.sqrt(in_dim), 1 / math.sqrt(in_dim))

    def forward(self, x):
        # (...,in_dim) @ (in_dim,out_dim) → (...,out_dim)。参数张量不能直接当布尔值。
        out = x @ self.weight.T
        if self.bias is not None:
            out = out + self.bias
        return out


class LayerNorm(nn.Module):
    def __init__(self, hidden_dim, eps=1e-5):
        super().__init__()
        self.weight = nn.Parameter(torch.ones(hidden_dim))
        self.bias = nn.Parameter(torch.zeros(hidden_dim))
        self.eps = eps

    def forward(self, x):
        # 最后一维单独统计；半精度输入先用 float32 算统计量，float64 输入保留精度。
        z = x.float() if x.dtype in (torch.float16, torch.bfloat16) else x
        mean = z.mean(dim=-1, keepdim=True)
        var = z.var(dim=-1, keepdim=True, unbiased=False)
        norm = ((z - mean) * torch.rsqrt(var + self.eps)).to(x.dtype)
        return norm * self.weight + self.bias


class RMSNorm(nn.Module):
    def __init__(self, hidden_dim, eps=1e-6):
        super().__init__()
        self.weight = nn.Parameter(torch.ones(hidden_dim))
        self.eps = eps

    def forward(self, x):
        # RMSNorm 不减均值，也不是计算方差；均方 = mean(x²)。
        z = x.float() if x.dtype in (torch.float16, torch.bfloat16) else x
        norm = (z * torch.rsqrt(z.square().mean(dim=-1, keepdim=True) + self.eps)).to(x.dtype)
        return norm * self.weight


class SwiGLU(nn.Module):
    def __init__(self, hidden_dim, intermediate_dim, bias=False):
        super().__init__()
        self.gate_proj = nn.Linear(hidden_dim, intermediate_dim, bias=bias)
        self.up_proj = nn.Linear(hidden_dim, intermediate_dim, bias=bias)
        self.down_proj = nn.Linear(intermediate_dim, hidden_dim, bias=bias)

    def forward(self, x):
        # 两条升维支路逐元素相乘；down_proj 再恢复 hidden_dim，不是拼接。
        gate = F.silu(self.gate_proj(x))
        up = self.up_proj(x)
        return self.down_proj(gate * up)


class LoRALinear(nn.Module):
    def __init__(self, in_dim, out_dim, rank=4, alpha=8, bias=True):
        super().__init__()
        if rank <= 0:
            raise ValueError("rank must be positive")
        self.base = nn.Linear(in_dim, out_dim, bias=bias)
        self.base.requires_grad_(False)
        self.a = nn.Linear(in_dim, rank, bias=False)
        self.b = nn.Linear(rank, out_dim, bias=False)
        self.scale = alpha / rank
        # A 随机、B 为零：初始增量为零，但 B 的初次梯度可以非零。
        nn.init.kaiming_uniform_(self.a.weight, a=math.sqrt(5))
        nn.init.zeros_(self.b.weight)

    def forward(self, x):
        return self.base(x) + self.scale * self.b(self.a(x))

    def merged_weight(self):
        # 返回合并后的权重用于 eval；不原地修改 base，避免下一次 forward 重复加增量。
        return self.base.weight + self.scale * (self.b.weight @ self.a.weight)


def ce_loss(logits, target):
    # 输入未归一化 logits (B,C)，不是概率；log_softmax 一次稳定完成 log 与归一化。
    if logits.ndim != 2 or logits.shape[0] == 0 or logits.shape[1] == 0:
        raise ValueError("logits must have shape (B,C)")
    log_prob = F.log_softmax(logits, dim=-1)
    if target.ndim == 1:
        if target.shape[0] != logits.shape[0] or target.dtype != torch.long:
            raise ValueError("class indices must be int64 with shape (B,)")
        loss = -log_prob.gather(-1, target.unsqueeze(-1)).squeeze(-1)
    elif target.shape == logits.shape:
        loss = -(target * log_prob).sum(dim=-1)
    else:
        raise ValueError("target must be indices (B,) or a distribution (B,C)")
    return loss.mean()


def causal_lm_loss(logits, labels, ignore_index=-100):
    # logits (B,T,V) 的最后一维是词表大小；第 t 个输出预测第 t+1 个标签。
    if logits.ndim != 3 or labels.shape != logits.shape[:2] or logits.shape[1] < 2:
        raise ValueError("expected logits (B,T,V), labels (B,T), and T>=2")
    shift_logits = logits[:, :-1, :].reshape(-1, logits.shape[-1])
    shift_labels = labels[:, 1:].reshape(-1)
    valid = shift_labels != ignore_index
    if not valid.any():
        raise ValueError("no supervised token after shifting")
    # 只对回答 token 监督时，上游先把 prompt、padding 的 labels 设置为 -100。
    return F.cross_entropy(shift_logits[valid], shift_labels[valid])


def sequence_logps(logits, labels, completion_mask):
    # (B,T,V) → (B,T-1) → (B,)；DPO 通常使用回答部分 token logp 的和。
    if logits.ndim != 3 or logits.shape[1] < 2 or labels.shape != logits.shape[:2] or completion_mask.shape != labels.shape:
        raise ValueError("expected logits (B,T,V), labels/mask (B,T), and T>=2")
    shifted_labels = labels[:, 1:].clamp_min(0)
    logp = F.log_softmax(logits[:, :-1, :], dim=-1)
    token_logp = logp.gather(-1, shifted_labels.unsqueeze(-1)).squeeze(-1)
    mask = completion_mask[:, 1:].bool() & (labels[:, 1:] >= 0)
    if (~mask.any(-1)).any():
        raise ValueError("each sequence must have a supervised completion token")
    return token_logp.masked_fill(~mask, 0).sum(dim=-1)


def dpo_loss(chosen_logp, rejected_logp, ref_chosen_logp, ref_rejected_logp, beta=0.1):
    # 同一 prompt 的 chosen/rejected 配对；参考模型固定，不向它传播梯度。
    if beta <= 0:
        raise ValueError("beta must be positive")
    if chosen_logp.ndim != 1 or chosen_logp.numel() == 0 or any(t.shape != chosen_logp.shape for t in (rejected_logp, ref_chosen_logp, ref_rejected_logp)):
        raise ValueError("all log probabilities must have matching shape (B,)")
    chosen_ratio = chosen_logp - ref_chosen_logp.detach()
    rejected_ratio = rejected_logp - ref_rejected_logp.detach()
    margin = chosen_ratio - rejected_ratio
    return -F.logsigmoid(beta * margin).mean()


def sampled_kl(logp, ref_logp, method="k3"):
    # x ~ 当前策略 p；logr = log(q/p)。明确采样方向与估计器，错误名称必须报错。
    logr = ref_logp.detach() - logp
    if method == "k1":
        return -logr
    if method == "k2":
        return logr.square() / 2
    if method == "k3":
        return torch.expm1(logr) - logr
    raise ValueError("method must be k1, k2 or k3")


def categorical_kl(logits_p, logits_q):
    # 可拿到完整词表分布时，精确 KL(p||q) 是 p 加权的 log 概率差。
    logp = F.log_softmax(logits_p, dim=-1)
    logq = F.log_softmax(logits_q, dim=-1)
    return (logp.exp() * (logp - logq)).sum(dim=-1)


def info_nce_loss(pairs, temperature=0.07, symmetric=True):
    if pairs.ndim != 3 or pairs.shape[1] != 2 or temperature <= 0:
        raise ValueError("expected pairs (B,2,D) and temperature>0")
    # L2 归一化后内积是余弦相似度；同一下标的两条视图是正样本。
    z1 = F.normalize(pairs[:, 0], dim=-1)
    z2 = F.normalize(pairs[:, 1], dim=-1)
    scores = z1 @ z2.T / temperature
    target = torch.arange(pairs.shape[0], device=pairs.device)
    left = F.cross_entropy(scores, target)
    return (left + F.cross_entropy(scores.T, target)) / 2 if symmetric else left


def grpo_loss(rewards, logp, ref_logp, old_logp, completion_mask, beta=0.01, clip_epsilon=0.2):
    # 本版：token 级 PPO ratio + 组内总体标准差 + 每条回答长度平均，再对有效回答平均。
    if logp.ndim != 3 or rewards.shape != logp.shape[:2] or logp.shape[1] < 2:
        raise ValueError("expected rewards (B,G), logp (B,G,T), G>=2")
    if ref_logp.shape != logp.shape or old_logp.shape != logp.shape or completion_mask.shape != logp.shape:
        raise ValueError("all token tensors must have shape (B,G,T)")
    if beta < 0 or not 0 < clip_epsilon < 1:
        raise ValueError("beta>=0 and 0<clip_epsilon<1 are required")
    mask = completion_mask.bool()
    length = mask.sum(dim=-1)
    if (length == 0).any():
        raise ValueError("every completion must have at least one valid token")
    # 奖励和 rollout/参考策略是固定数据，不参与当前策略反向传播。
    reward = rewards.detach()
    advantage = (reward - reward.mean(-1, keepdim=True)) / (reward.std(-1, keepdim=True, unbiased=False) + 1e-8)
    advantage = advantage.unsqueeze(-1)
    current = logp.masked_fill(~mask, 0)
    old = old_logp.detach().masked_fill(~mask, 0)
    reference = ref_logp.detach().masked_fill(~mask, 0)
    ratio = (current - old).exp()
    clipped = ratio.clamp(1 - clip_epsilon, 1 + clip_epsilon)
    objective = torch.minimum(ratio * advantage, clipped * advantage)
    delta = reference - current
    kl = torch.expm1(delta) - delta
    token_loss = (-objective + beta * kl).masked_fill(~mask, 0)
    return (token_loss.sum(-1) / length).mean()


class RoPEEmbedding(nn.Module):
    def __init__(self, head_dim, base=10000):
        super().__init__()
        if head_dim <= 0 or head_dim % 2 or base <= 1:
            raise ValueError("head_dim must be positive/even and base>1")
        self.head_dim = head_dim
        # buffer 会跟随 model.to(device)，但不会作为可训练参数交给优化器。
        inv_freq = base ** (-torch.arange(0, head_dim, 2, dtype=torch.float32) / head_dim)
        self.register_buffer("inv_freq", inv_freq, persistent=False)

    def forward(self, x, offset=0):
        # x (B,H,T,D)，缓存续写从绝对位置 offset 开始；这里只生成当前段的角度。
        if x.ndim != 4 or x.shape[-1] != self.head_dim or offset < 0:
            raise ValueError("expected x (B,H,T,head_dim) and offset>=0")
        positions = torch.arange(offset, offset + x.shape[-2], device=x.device, dtype=self.inv_freq.dtype)
        angles = positions[:, None] * self.inv_freq[None, :]
        cos, sin = angles.cos().to(x.dtype), angles.sin().to(x.dtype)
        even, odd = x[..., 0::2], x[..., 1::2]
        out_even = even * cos - odd * sin
        out_odd = even * sin + odd * cos
        return torch.stack((out_even, out_odd), dim=-1).flatten(-2)


def _attention_weights(scores, blocked_mask=None):
    # bool mask=True 表示屏蔽，可广播到 (B,H,Tq,Tk)。全屏蔽行的上下文贡献为零。
    if blocked_mask is None:
        return scores.softmax(-1)
    if blocked_mask.dtype != torch.bool:
        raise ValueError("blocked_mask must be boolean; True means blocked")
    scores = scores.masked_fill(blocked_mask, -torch.inf)
    all_blocked = torch.isneginf(scores).all(-1, keepdim=True)
    # 先避免 softmax(-inf,...,-inf)，再清零；不能只在 NaN 之后修复前向结果。
    safe_scores = scores.masked_fill(all_blocked, 0)
    return safe_scores.softmax(-1).masked_fill(all_blocked, 0)


class MultiHeadAttention(nn.Module):
    def __init__(self, embed_dim, num_heads, dropout=0.0):
        super().__init__()
        if min(embed_dim, num_heads) <= 0 or embed_dim % num_heads or (embed_dim // num_heads) % 2:
            raise ValueError("embed_dim divisible by heads; RoPE head_dim must be even")
        self.num_heads, self.head_dim = num_heads, embed_dim // num_heads
        self.q_proj = nn.Linear(embed_dim, embed_dim)
        self.k_proj = nn.Linear(embed_dim, embed_dim)
        self.v_proj = nn.Linear(embed_dim, embed_dim)
        self.o_proj = nn.Linear(embed_dim, embed_dim)
        self.rope = RoPEEmbedding(self.head_dim)
        self.dropout = nn.Dropout(dropout)

    def forward(self, x, blocked_mask=None):
        B, T, M = x.shape
        # 只切特征维，全部 T 个 token 仍在每个 head 中；mask=True 表示禁止读取。
        q = self.q_proj(x).reshape(B, T, self.num_heads, self.head_dim).transpose(1, 2)
        k = self.k_proj(x).reshape(B, T, self.num_heads, self.head_dim).transpose(1, 2)
        v = self.v_proj(x).reshape(B, T, self.num_heads, self.head_dim).transpose(1, 2)
        q, k = self.rope(q), self.rope(k)
        scores = q @ k.transpose(-2, -1) / math.sqrt(self.head_dim)
        weights = _attention_weights(scores, blocked_mask)
        # 全屏蔽行按约定贡献 0；有效行仍正常归一化。训练时 dropout 后行和未必是 1。
        out = self.dropout(weights) @ v
        return self.o_proj(out.transpose(1, 2).reshape(B, T, M))


class GroupedQueryAttention(nn.Module):
    def __init__(self, embed_dim, num_heads, num_kv_heads):
        super().__init__()
        if min(embed_dim, num_heads, num_kv_heads) <= 0 or embed_dim % num_heads or num_heads % num_kv_heads:
            raise ValueError("embed_dim%heads==0 and heads%kv_heads==0 are required")
        self.head_dim = embed_dim // num_heads
        if self.head_dim % 2:
            raise ValueError("RoPE head_dim must be even")
        self.num_heads, self.num_kv_heads = num_heads, num_kv_heads
        self.group_size = num_heads // num_kv_heads
        self.q_proj = nn.Linear(embed_dim, embed_dim)
        self.k_proj = nn.Linear(embed_dim, num_kv_heads * self.head_dim)
        self.v_proj = nn.Linear(embed_dim, num_kv_heads * self.head_dim)
        self.o_proj = nn.Linear(embed_dim, embed_dim)
        self.rope = RoPEEmbedding(self.head_dim)

    def forward(self, x, blocked_mask=None):
        B, T, M = x.shape
        q = self.q_proj(x).reshape(B, T, self.num_heads, self.head_dim).transpose(1, 2)
        k = self.k_proj(x).reshape(B, T, self.num_kv_heads, self.head_dim).transpose(1, 2)
        v = self.v_proj(x).reshape(B, T, self.num_kv_heads, self.head_dim).transpose(1, 2)
        q, k = self.rope(q), self.rope(k)
        # 相邻 Query heads 共享同组 K/V。展开是教学版临时张量，缓存应保留压缩形式。
        k = k.repeat_interleave(self.group_size, dim=1)
        v = v.repeat_interleave(self.group_size, dim=1)
        scores = q @ k.transpose(-2, -1) / math.sqrt(self.head_dim)
        weights = _attention_weights(scores, blocked_mask)
        out = weights @ v
        return self.o_proj(out.transpose(1, 2).reshape(B, T, M))


class MultiHeadAttentionWithKVCache(nn.Module):
    def __init__(self, embed_dim, num_heads):
        super().__init__()
        if min(embed_dim, num_heads) <= 0 or embed_dim % num_heads or (embed_dim // num_heads) % 2:
            raise ValueError("embed_dim divisible by positive heads, even head_dim required")
        self.num_heads, self.head_dim = num_heads, embed_dim // num_heads
        self.q_proj = nn.Linear(embed_dim, embed_dim)
        self.k_proj = nn.Linear(embed_dim, embed_dim)
        self.v_proj = nn.Linear(embed_dim, embed_dim)
        self.o_proj = nn.Linear(embed_dim, embed_dim)
        self.rope = RoPEEmbedding(self.head_dim)

    def forward(self, x, past_kv=None, blocked_mask=None):
        B, T, M = x.shape
        # 外部显式传入缓存，每个请求维护自己的 past_kv，模块里不保存跨请求状态。
        past_len = 0 if past_kv is None else past_kv[0].shape[-2]
        if past_kv is not None:
            expected = (B, self.num_heads, past_len, self.head_dim)
            if past_kv[0].shape != expected or past_kv[1].shape != expected:
                raise ValueError("cache must contain matching K/V (B,H,L,D)")
            if any(t.device != x.device or t.dtype != x.dtype for t in past_kv):
                raise ValueError("cache dtype/device must match x")
        q = self.q_proj(x).reshape(B, T, self.num_heads, self.head_dim).transpose(1, 2)
        k = self.k_proj(x).reshape(B, T, self.num_heads, self.head_dim).transpose(1, 2)
        v = self.v_proj(x).reshape(B, T, self.num_heads, self.head_dim).transpose(1, 2)
        # 历史 K 已经旋转过，只给本次新 Q/K 按 offset 旋转，V 始终保持未旋转。
        q, k = self.rope(q, past_len), self.rope(k, past_len)
        if past_kv is not None:
            k = torch.cat((past_kv[0], k), dim=-2)
            v = torch.cat((past_kv[1], v), dim=-2)
        # 矩形 causal mask：新 Query 的绝对位置 = past_len + 行号。
        query_pos = past_len + torch.arange(T, device=x.device)
        key_pos = torch.arange(k.shape[-2], device=x.device)
        blocked = key_pos[None, :] > query_pos[:, None]
        if blocked_mask is not None:
            if blocked_mask.dtype != torch.bool:
                raise ValueError("blocked_mask must be boolean; True means blocked")
            blocked = blocked | blocked_mask
        scores = q @ k.transpose(-2, -1) / math.sqrt(self.head_dim)
        weights = _attention_weights(scores, blocked)
        out = weights @ v
        out = self.o_proj(out.transpose(1, 2).reshape(B, T, M))
        return out, weights, (k, v)


class BPETokenizer:
    END = "</w>"

    def __init__(self, vocab_size=100):
        self.vocab_size = vocab_size
        self.vocab, self.merges = {}, []

    @staticmethod
    def merge(symbols, pair):
        # 从左到右做不重叠替换：aaa 合并 aa 时只能先得到 aa,a。
        result, i = [], 0
        while i < len(symbols):
            if i + 1 < len(symbols) and (symbols[i], symbols[i + 1]) == pair:
                result.append(symbols[i] + symbols[i + 1])
                i += 2
            else:
                result.append(symbols[i])
                i += 1
        return tuple(result)

    def fit(self, corpus):
        counts = Counter(corpus.split())
        if not counts:
            raise ValueError("corpus must contain at least one word")
        words = {tuple(word) + (self.END,): n for word, n in counts.items()}
        alphabet = sorted({symbol for word in words for symbol in word})
        if self.vocab_size < len(alphabet) + 1:
            raise ValueError("vocab_size must include <unk> and the initial alphabet")
        # 排序字母表与同频 pair，确保训练可复现；重新 fit 必须清空旧规则。
        self.vocab = {symbol: i for i, symbol in enumerate(["<unk>"] + alphabet)}
        self.merges = []
        while len(self.vocab) < self.vocab_size:
            pairs = Counter()
            for word, frequency in words.items():
                for pair in zip(word, word[1:]):
                    pairs[pair] += frequency
            if not pairs:
                break
            best = min(pairs, key=lambda pair: (-pairs[pair], pair))
            merged = defaultdict(int)
            for word, frequency in words.items():
                merged[self.merge(word, best)] += frequency
            words = dict(merged)
            self.merges.append(best)
            symbol = "".join(best)
            if symbol not in self.vocab:
                self.vocab[symbol] = len(self.vocab)
        return self

    def encode(self, text):
        if not self.vocab:
            raise ValueError("call fit before encode")
        ids = []
        for word in text.split():
            symbols = tuple(word) + (self.END,)
            # 编码按学习顺序回放，不能重新按输入频率选择 pair。
            for pair in self.merges:
                symbols = self.merge(symbols, pair)
            ids.extend(self.vocab.get(symbol, self.vocab["<unk>"]) for symbol in symbols)
        return ids

    def decode(self, ids):
        inverse = {i: symbol for symbol, i in self.vocab.items()}
        return "".join(inverse[i] for i in ids).replace(self.END, " ").strip()


def react_agent(question, llm, tools, max_steps=5):
    if max_steps <= 0:
        raise ValueError("max_steps must be positive")
    history = []
    for _ in range(max_steps):
        # 注入 llm 依赖：协议是 dict，不是假装定义了一个可直接联网的全局 llm。
        action = llm({"question": question, "history": list(history)})
        try:
            if not isinstance(action, dict) or not isinstance(action.get("tool"), str):
                raise ValueError("expected an action dict with a string tool")
            if action["tool"] == "finish":
                if not isinstance(action.get("input"), str):
                    raise ValueError("finish input must be an answer string")
                return action["input"]
            if action["tool"] not in tools:
                raise ValueError("unknown registered tool")
            # 只执行已注册函数，不用 eval；参数约定是一个 input 对象。
            result = tools[action["tool"]](action.get("input"))
            observation = {"ok": True, "result": result}
        except Exception as error:
            observation = {"ok": False, "error": str(error)}
        history.append({"action": action, "observation": observation})
    return "达到最大模型调用次数，任务未完成"
