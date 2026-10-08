// 每题正文与阶段说明；Python 实现只维护在 standard_algorithms.py。
export const groups = [
  ['basics', '基础算子与网络组件'], ['attention', '注意力与推理缓存'],
  ['training', '损失函数与训练对齐'], ['systems', '分词与 Agent']
];

export const topics = [
  {
    id:'sigmoid', group:'basics', title:'Sigmoid', source:'Sigmoid.py', symbols:['sigmoid'], library:'NumPy',
    intro:'把一个实数映射到 0～1，可作为二分类正类概率，也可作为门控值。重点不是照抄 1/(1+exp(-x))，而是让极大、极小的输入也能稳定计算。',
    contract:[['x','任意形状的有限实数数组','保留输入形状，内部使用 float64'],['output','与 x 同形状','每个元素独立计算']],
    formulas:[String.raw`\sigma(x)=\frac{1}{1+e^{-x}}`,String.raw`\sigma'(x)=\sigma(x)(1-\sigma(x))`],
    flow:['输入实数 x','按 x≥0 分支','正分支 exp(-x) / 负分支 exp(x)','还原原始形状'],
    steps:[['positive =','按正负划分','大负数若直接算 exp(-x)，会指数溢出。布尔索引只计算当前分支需要的元素，不会像 np.where 那样先把两个表达式都算一遍。'],['out[positive]','非负分支','x≥0 时 exp(-x)≤1，1/(1+exp(-x)) 稳定。'],['exp_x =','负数分支','把分子分母同时乘 exp(x)，得到 exp(x)/(1+exp(x))；此时 exp(x)≤1，同样不会溢出。']],
    example:'sigmoid([-1000, 0, 1000])\n# array([0., 0.5, 1.])；极端值可能因有限精度饱和',
    pitfalls:['Sigmoid 与 Softmax 不同：前者每个元素独立，输出并不要求总和为 1。','大正、大负区域的导数趋近 0，所以不能因为数值稳定就认为不会梯度饱和。','PyTorch 训练用 torch.sigmoid；本题 NumPy 版用于理解稳定计算，不建立自动求导图。'], complexity:'时间 O(N)，输出与中间空间 O(N)。'
  },
  {
    id:'silu',group:'basics',title:'SiLU / Swish',source:'SiLU.py',symbols:['sigmoid','silu'],library:'NumPy',
    intro:'SiLU 让输入乘上自己的 Sigmoid 门控。它常用于现代大模型的前馈层；负数不会像 ReLU 那样全部被硬截为 0。',
    contract:[['x','任意形状','有限实数数组'],['output','与 x 同形状','可以为负数，也可以大于 1']],
    formulas:[String.raw`\operatorname{SiLU}(x)=x\sigma(x)`,String.raw`\operatorname{SiLU}'(x)=\sigma(x)+x\sigma(x)(1-\sigma(x))`],
    flow:['输入 x','计算稳定 sigmoid(x)','逐元素 x × sigmoid(x)','平滑门控后的输出'],
    steps:[['def sigmoid','共用稳定 Sigmoid','这一辅助函数来自上一题，用正负分支避免 exp 溢出。'],['def silu','逐元素门控','先转数组，随后 x * sigmoid(x) 按对应元素相乘；不是点积，也不是把所有元素压缩成一个标量。']],
    example:'silu([-1, 0, 1])\n# array([-0.26894142, 0., 0.73105858])',
    pitfalls:['SiLU 是激活函数，SwiGLU 是包含两条投影支路与输出投影的 FFN 结构。','SiLU 的负半轴存在小幅负输出；输出不在 0～1 范围。'],complexity:'时间 O(N)，空间 O(N)。'
  },
  {
    id:'softmax',group:'basics',title:'稳定 Softmax',source:'Softmax.py',symbols:['softmax'],library:'NumPy',
    intro:'沿指定的轴把 logits 变成一组和为 1 的概率。每组先减自己的最大值，再做指数与归一化；这一步保留概率结果，同时避免大正数指数溢出。',
    contract:[['x','任意非空有限 logits 数组','尚未归一化的得分'],['axis','默认 -1','选定归一化轴；二维 attention 的最后一轴是 Key'],['output','与 x 同形状','沿 axis 求和为 1']],
    formulas:[String.raw`p_i=\frac{e^{x_i-m}}{\sum_j e^{x_j-m}},\quad m=\max_j x_j`],
    flow:['logits 每行','max：保留一列','每行减自己的最大值','exp → sum → 除以行分母'],
    steps:[['shifted =','减最大值与广播','x.max(axis=axis,keepdims=True) 把归约轴长度保留为 1。例如 (B,C)→(B,1)，然后广播回每一行。'],['exp_x =','逐元素指数','np.exp 不是矩阵指数。每组最大值已经变成 0，至少有一个 exp(0)=1。'],['return exp_x','归一化','分母沿同一轴求和并保留维度；不能对整个矩阵求一个全局分母。']],
    example:'softmax([[1000, 1001, 1002]], axis=-1)\n# array([[0.09003057, 0.24472847, 0.66524096]])',
    pitfalls:['NumPy 参数为 keepdims，PyTorch 是 keepdim。','本函数约定输入为有限 logits。attention 屏蔽引入 -inf 时需要额外处理全屏蔽行，不能直接套用本题。','做 CE 时直接使用 log_softmax 或 cross_entropy，避免先算概率再取 log。'],complexity:'时间 O(N)，空间 O(N)。',related:'softmax.html'
  },
  {
    id:'linear',group:'basics',title:'Linear 全连接层',source:'Linear.py',symbols:['Linear'],library:'PyTorch',
    intro:'最后一维做线性映射，其余 batch、token 轴都保留。参数布局沿用 nn.Linear：weight 保存为 (out_dim,in_dim)，所以前向使用转置。',
    contract:[['x','(...,in_dim)','最后一维是输入特征'],['weight / bias','(out_dim,in_dim) / (out_dim,)','bias 可关闭'],['output','(...,out_dim)','前面的维度保持不变']],
    formulas:[String.raw`Y=XW^{\mathsf T}+b`],flow:['输入 (...,in)','乘 weight.T (in,out)','bias 广播到前面的所有位置','输出 (...,out)'],
    steps:[['self.weight =','注册权重','nn.Parameter 才会被 module.parameters() 收集并交给优化器。这里采用 PyTorch 的参数布局，不把它解释成普遍的性能定律。'],['nn.init.kaiming','初始化','沿用 nn.Linear 的初始化口径，而不是给每层直接用未缩放的标准正态随机数。'],['out = x @','矩阵乘法','@ 收缩最后一维 in_dim。weight.T 是 (in_dim,out_dim)，输出最后一维变成 out_dim。'],['if self.bias is not None','偏置可选','不能写 if self.bias：多元素 Tensor 没有唯一布尔值。用 is not None 判断是否存在偏置。']],
    example:'layer = Linear(4, 6)\nx = torch.randn(2, 3, 4)\nassert layer(x).shape == (2, 3, 6)',
    pitfalls:['weight 的布局与手算 XW（W 为 in×out）不同；两种约定都可以，但转置必须一致。','初始化、参数注册、偏置判断都是模块手撕的一部分。'],complexity:'时间 O(BT·in·out)，参数 O(in·out+out)。'
  },
  {
    id:'layernorm',group:'basics',title:'LayerNorm',source:'LN.py',symbols:['LayerNorm'],library:'PyTorch',
    intro:'对每个 token 的最后一维分别求均值和方差，再做可学习的缩放与平移。不混用不同样本的统计量，也不维护 BatchNorm 的滑动统计量。',
    contract:[['x','(...,D)','浮点张量，最后一维 D=hidden_dim'],['weight / bias','(D,) / (D,)','初始为 1 / 0'],['output','与 x 同形状','逐 token 归一化']],
    formulas:[String.raw`\mu=\frac1D\sum_i x_i,\quad v=\frac1D\sum_i(x_i-\mu)^2`,String.raw`y_i=\gamma_i\frac{x_i-\mu}{\sqrt{v+\epsilon}}+\beta_i`],
    flow:['每个 token 的 D 维','mean / 总体 variance','减均值 × rsqrt(var+eps)','逐维 gamma / beta'],
    steps:[['z =','提升统计精度','float16 / bfloat16 输入用 float32 算统计量；float64 输入保留精度。模块参数应通过 .to(...) 与输入 device/dtype 配套。'],['mean =','最后一维求均值','dim=-1 把每个 token 独立处理，keepdim=True 留下 (...,1) 方便广播。'],['var =','总体方差','unbiased=False 使用除以 D 的总体方差，不是统计估计中的 D-1。'],['norm =','归一化','rsqrt(a) 是 1/sqrt(a)，eps 放在根号里面。归一化结果转回输入 dtype。'],['return norm','仿射变换','每个特征都有自己的 gamma / beta；有仿射参数后输出不必再严格均值 0、方差 1。']],
    example:'layer = LayerNorm(3)\nx = torch.tensor([[1., 2., 3.]])\n# 初始化下约为 [[-1.2247, 0., 1.2247]]',
    pitfalls:['LayerNorm 不是跨 batch 统计，也不是对整个三维张量求一个均值。','eps 使常量向量也能计算；D=1 时标准化部分为 0。'],complexity:'时间 O(ND)，参数 O(D)。'
  },
  {
    id:'rmsnorm',group:'basics',title:'RMSNorm',source:'RMSNorm.py',symbols:['RMSNorm'],library:'PyTorch',
    intro:'只按均方根控制输入的幅度，不减均值。它比 LayerNorm 少了中心化操作，标准版本只保留可学习 scale。',
    contract:[['x','(...,D)','最后一维单独统计'],['weight','(D,)','可学习缩放，初始全 1'],['output','与 x 同形状','均值不一定为 0']],
    formulas:[String.raw`\operatorname{RMS}(x)=\sqrt{\frac1D\sum_i x_i^2+\epsilon}`,String.raw`y_i=\gamma_i\frac{x_i}{\operatorname{RMS}(x)}`],
    flow:['token 特征 x','square → mean','rsqrt(mean(x²)+eps)','乘 x 与可学习 scale'],
    steps:[['self.weight =','模块参数','必须定义 class RMSNorm(nn.Module)，不能把类写成 def。默认没有 bias。'],['z =','统计精度','半精度输入先提升到 float32，避免平方与归约时累积误差。'],['norm =','均方而非方差','square().mean(-1,keepdim=True) 得到 E[x²]；没有减均值，所以不能改写成 var(x)。'],['return norm','恢复尺度','归一化后再乘可学习 weight，每个通道都可以学习不同的尺度。']],
    example:'layer = RMSNorm(2, eps=0.)\nx = torch.tensor([[3., 4.]])\n# sqrt((9+16)/2)=sqrt(12.5)\n# 输出约 [[0.848528, 1.131371]]',
    pitfalls:['RMSNorm 与 L2 normalize 的尺度不同：RMS 使用 mean(x²)，L2 norm 使用 sum(x²)。','scale 可学习；“归一化”不意味着丢弃所有幅度信息。'],complexity:'时间 O(ND)，参数 O(D)。'
  },
  {
    id:'swiglu',group:'basics',title:'SwiGLU 前馈网络',source:'SwiGLU.py',symbols:['SwiGLU'],library:'PyTorch',
    intro:'两条支路分别投影，一条经过 SiLU 作为门控，与另一条逐元素相乘，再用 down projection 映射回隐藏维度。它不是一个独立的单行激活函数。',
    contract:[['x','(B,T,D)','hidden_dim=D'],['gate / up','(B,T,I)','intermediate_dim=I'],['output','(B,T,D)','接回残差主干']],
    formulas:[String.raw`\operatorname{SwiGLU}(x)=W_{\mathrm{down}}\big(\operatorname{SiLU}(W_{\mathrm{gate}}x)\odot W_{\mathrm{up}}x\big)`],
    flow:['输入 D 维','gate: D→I，SiLU ∥ up: D→I','两路逐元素相乘 (I)','down: I→D'],
    steps:[['self.gate_proj','两条升维与一条降维','gate 与 up 都读取完整的输入 D 维，有各自独立的参数；down 负责把 I 维映射回 D 维。'],['gate =','门控分支','先做线性投影，再用 F.silu。不能对原输入做 SiLU 后才投影而声称完全等价。'],['up =','内容分支','这一路不加激活，保留线性变换后的内容特征。'],['return self.down_proj','融合与回投影','gate * up 是对应元素相乘，不是 concat；down_proj 的输入维度是 I，而不是 2I。']],
    example:'ffn = SwiGLU(8, 16)\nassert ffn(torch.randn(2, 3, 8)).shape == (2, 3, 8)',
    pitfalls:['无偏置版本约有 3DI 个参数；普通两层 FFN 约有 2DI，所以比较时必须明确中间维度。','部分模型用 intermediate≈8D/3 来接近传统 4D FFN 的参数量，但这是配置选择。'],complexity:'时间 O(BTDI)，参数约 3DI（bias=False）。'
  },
  {
    id:'lora',group:'training',title:'LoRA 低秩适配',source:'LoRA.py',symbols:['LoRALinear'],library:'PyTorch',
    intro:'冻结原始线性层，只训练一个低秩增量。A 把输入压缩到 rank，B 再映射回 out_dim，增量与原始输出相加。',
    contract:[['x','(...,in_dim)','完整输入特征'],['A / B','(r,in_dim) / (out_dim,r)','rank=r>0'],['scale','alpha/r','控制增量幅度'],['output','(...,out_dim)','base(x) + scale·B(A(x))']],
    formulas:[String.raw`W'=W+\frac\alpha r BA,\quad A\in\mathbb R^{r\times d_{in}},\quad B\in\mathbb R^{d_{out}\times r}`],
    flow:['输入 x','冻结 base ∥ 可训练 A→B','base(x) + alpha/r × B(A(x))','推理可合并增量'],
    steps:[['self.base =','冻结基座','base.requires_grad_(False) 同时冻结 weight 与 bias；优化器只需要 A/B 的可训练参数。'],['self.a =','低秩参数','两个小矩阵的可训练参数量是 r(in+out)，而不是 in×out。'],['nn.init.kaiming','初始增量为零','A 随机、B 全零保证初始输出等于 base。第一步 B 可获得梯度，A 的初次梯度为零；不能把两者都初始化成零。'],['return self.base','并行相加','B(A(x)) 使用低秩通道，base(x) 保持原层行为。'],['def merged_weight','合并权重','B.weight @ A.weight 的形状是 (out,in)。这里返回新权重，不原地修改 base，避免下次 forward 再加一次增量。']],
    example:'layer = LoRALinear(8, 12, rank=2, alpha=4)\nx = torch.randn(3, 8)\nassert torch.allclose(layer(x), layer.base(x))\n# 初始 B=0；加载预训练 weight 到 base 后再训练 A/B',
    pitfalls:['本题用随机 base 演示结构；真实适配需要先载入预训练权重。','merged_weight 返回权重；使用 F.linear(x,merged_weight,base.bias) 即可验证合并结果，不能继续叠加 LoRA 支路。','LoRA 减少的是可训练参数与优化器状态，前向仍需要执行 base。'],complexity:'额外时间 O(Nr(in+out))；可训练参数 r(in+out)。'
  },
  {
    id:'rope',group:'attention',title:'RoPE 模块版与 offset',source:'RoPE.py',symbols:['RoPEEmbedding'],library:'PyTorch',
    intro:'在每个 head 的通道对上做位置旋转。本题把基础二维 RoPE 扩展为 (B,H,T,D) 模块，并明确缓存推理中的 offset；采用相邻通道配对布局。',
    contract:[['x','(B,H,T,D)','浮点张量，D=head_dim 为正偶数'],['offset','非负整数','本次第一个 token 的绝对位置'],['output','(B,H,T,D)','每个通道对独立旋转']],
    formulas:[String.raw`\theta_{p,i}=p\cdot\mathrm{base}^{-2i/D}`,String.raw`\begin{bmatrix}x'_{2i}\\x'_{2i+1}\end{bmatrix}=\begin{bmatrix}\cos\theta&-\sin\theta\\\sin\theta&\cos\theta\end{bmatrix}\begin{bmatrix}x_{2i}\\x_{2i+1}\end{bmatrix}`],
    flow:['x: (B,H,T,D)','positions = offset…offset+T−1','角度 (T,D/2) 广播到 B/H','偶奇通道旋转 → 交错还原'],
    steps:[['inv_freq =','逆频率','arange(0,D,2)/D 等价于 2i/D。这里是 arange，不是不存在的 arrange，也不是已弃用的 range。'],['self.register_buffer','注册非参数状态','inv_freq 跟随模块 .to(device)，不会被优化器更新；persistent=False 表示不写进 state_dict，可按配置重建。'],['positions =','缓存位置偏移','历史已有 L 个 token 时 offset=L，新 token 使用 L,L+1…；不能每次 decode 都从 0 开始。'],['angles =','二维广播','(T,1)×(1,D/2) 得到 (T,D/2)，在乘 x 时再广播到 B/H。'],['even, odd =','相邻通道配对','0::2 与 1::2 分别取每对的第一个、第二个坐标；必须与训练时的布局一致。'],['out_even =','旋转与还原','两条公式完成二维旋转，stack(...,dim=-1) 得到 (...,D/2,2)，flatten(-2) 按原始相邻布局恢复 D。']],
    example:'rope = RoPEEmbedding(4)\nx = torch.randn(2, 3, 5, 4)\nassert rope(x).shape == x.shape\n# 一次算全序列与按 offset 分段算的结果相同',
    pitfalls:['只对 Q/K 旋转，不对 V 旋转；已缓存的历史 K 不能再次旋转。','本题只覆盖完整 head 的标准 RoPE，不包含 YaRN、动态 NTK、partial rotary 或不连续 position_ids。','half-split 与相邻配对不能直接混用；不同 checkpoint 要按它自己的布局执行。'],complexity:'时间 O(BHTD)，当前段角度空间 O(TD)。',related:'rope.html'
  },
  {
    id:'mha',group:'attention',title:'MHA 模块版',source:'MHA.py',symbols:['RoPEEmbedding','_attention_weights','MultiHeadAttention'],library:'PyTorch',
    intro:'标准多头自注意力：每个 Q head 有独立 K/V head。本实现补齐 RoPE、bool mask 与 dropout；返回投影后的输出，参数由模块维护。',
    contract:[['x','(B,T,M)','M=embed_dim，M 能被 H 整除'],['Q/K/V','(B,H,T,D)','D=M/H，为正偶数以接入 RoPE'],['blocked_mask','可广播到 (B,H,T,T)','bool，True 表示禁止读取'],['output','(B,T,M)','拼头后通过 o_proj']],
    formulas:[String.raw`A=\operatorname{softmax}\!\left(\frac{QK^{\mathsf T}}{\sqrt D}+\mathrm{mask}\right),\quad O=\operatorname{Concat}(AV)W_O`],
    flow:['输入 (B,T,M)','投影 + 分头 (B,H,T,D)','旋转 Q/K，得分 (B,H,T,T)','mask → softmax → dropout','读取 V，拼头 → 输出投影'],
    steps:[['class RoPEEmbedding','共享位置模块','辅助 RoPE 完整代码与上一题一致；只旋转 Q/K，position 从 0 开始。'],['def _attention_weights','稳定屏蔽归一化','布尔 mask 的 True 位置置 -inf。全屏蔽行先改成安全 logits，再把整行权重置 0，避免前向与反向出现 NaN。'],['class MultiHeadAttention','模块与参数','Q/K/V/O 各自是线性层；参数维度都保持 M，分头只是投影之后的张量整理。'],['q = self.q_proj','分头','(B,T,M)→(B,T,H,D)→(B,H,T,D)。每个 head 都保留全部 T 个 token。'],['q, k =','旋转 Q/K','V 不旋转。Q/K 的位置角度参与后面的点积。'],['scores =','缩放点积','只转置 K 的最后两轴，(B,H,T,D)@(B,H,D,T)→(B,H,T,T)。'],['weights =','权重与输出','先在 Key 轴 softmax。dropout 仅在训练模式生效；拼回时先 transpose 再 reshape，防止 token/head 顺序错乱。']],
    example:'layer = MultiHeadAttention(8, 2).eval()\nx = torch.randn(1, 4, 8)\nmask = torch.triu(torch.ones(4, 4, dtype=torch.bool), diagonal=1)\nassert layer(x, mask).shape == (1, 4, 8)',
    pitfalls:['模块默认不自动加 causal mask；训练 decoder 时由调用方传入。KV Cache 那题自动处理因果关系。','True=屏蔽是本题约定；部分 PyTorch API 的 bool mask 语义相反，接入前要核对。','全屏蔽行上下文为 0，但 o_proj 若有 bias，最终输出可能不为 0。','训练时 dropout 后权重行和未必为 1；eval 下关闭 dropout。'],complexity:'投影 O(BTM²)，attention O(BT²M)，得分空间 O(BHT²)。',related:'multi-head-attention.html'
  },
  {
    id:'gqa',group:'attention',title:'GQA 模块版',source:'GQA.py',symbols:['RoPEEmbedding','_attention_weights','GroupedQueryAttention'],library:'PyTorch',
    intro:'Q 有 H 个头，K/V 只有 Hkv 个头。每组 Query 共享一份 K/V，但仍分别计算自己的 attention。本题把原来截断的脚本补成可运行模块。',
    contract:[['x','(B,T,M)','D=M/H 为正偶数'],['Q','(B,H,T,D)','H 个查询头'],['K/V','(B,Hkv,T,D)','H%Hkv=0，压缩投影宽度 Hkv·D'],['output','(B,T,M)','仍拼接 H 个输出头']],
    formulas:[String.raw`g=H/H_{kv},\quad \operatorname{kv}(i)=\left\lfloor i/g\right\rfloor`,String.raw`H_i=\operatorname{softmax}\!\left(\frac{Q_iK_{\operatorname{kv}(i)}^{\mathsf T}}{\sqrt D}\right)V_{\operatorname{kv}(i)}`],
    flow:['Q 投影 M ∥ K/V 投影 Hkv·D','Q H 头 ∥ K/V Hkv 头','每组 Query 共享同一个 KV','各头独立 attention → 拼 H 头'],
    steps:[['class RoPEEmbedding','共享辅助模块','Q/K 采用与 RoPE 题相同的相邻通道旋转；辅助 softmax 处理 bool mask 与全屏蔽行。'],['class GroupedQueryAttention','整除关系','用取余 % 判断整除。原稿把 // 写进 assert，会得到错误的条件；要求 M%H=0、H%Hkv=0。'],['self.k_proj =','压缩 K/V 投影','不是先生成 M 维 K/V 再切掉部分通道，而是直接用 Linear(M,Hkv·D)。'],['q = self.q_proj','不同头数的拆分','Q 分成 H 份，K/V 只分成 Hkv 份，每头维度 D 相同，每个头仍保留全部 token。'],['k = k.repeat_interleave','对齐组映射','沿 head 轴连续复制：[KV0,KV0,KV1,KV1]。这是教学版临时展开；真实 cache 应保留 (B,Hkv,T,D) 压缩形态。'],['scores =','每个 Q 独立计算','共享 KV 不等于输出相同；不同 Q 导致不同 score、attention 权重与输出。']],
    example:'layer = GroupedQueryAttention(16, 4, 2)\nx = torch.randn(2, 5, 16)\nassert layer(x).shape == (2, 5, 16)\n# group_size=2：Q0/Q1→KV0，Q2/Q3→KV1',
    pitfalls:['Hkv=H 退化成 MHA，Hkv=1 是 MQA；结构条件不同于具体权重是否相同。','repeat_interleave 会临时物化张量，本实现不是高性能融合 kernel。','压缩 K/V 节约缓存，不把 Q 的头数或输出宽度也压小。'],complexity:'attention 仍约 O(BT²M)；压缩 K/V 存储为 O(BTHkvD)，是 MHA 的 Hkv/H。',related:'grouped-query-attention.html'
  },
  {
    id:'kv-cache',group:'attention',title:'MHA + KV Cache',source:'MHA_KVCache.py',symbols:['RoPEEmbedding','_attention_weights','MultiHeadAttentionWithKVCache'],library:'PyTorch',
    intro:'自回归推理每次只投影新 token，把新 K/V 追加到历史缓存，并让新 Q 读取所有可见历史。重点是位置偏移、矩形 causal mask 与请求间的缓存隔离。',
    contract:[['x','(B,Tnew,M)','prefill 可以多 token，decode 通常为 1'],['past_kv','K/V 各 (B,H,L,D)','历史 K 已经做过 RoPE；dtype/device 与 x 一致'],['return','output, weights, (K,V)','output (B,Tnew,M)，weights (B,H,Tnew,L+Tnew)']],
    formulas:[String.raw`K_{all}=\operatorname{Concat}(K_{past},\operatorname{RoPE}(K_{new},L))`,String.raw`\mathrm{blocked}_{i,j}=[j>L+i]`],
    flow:['请求持有 past K/V (L)','新 Q/K 从位置 L 旋转；V 不转','沿 token 轴追加新 K/V','矩形 mask：Key 位置≤Query 位置','输出 + present cache → 下一次调用'],
    steps:[['class RoPEEmbedding','位置辅助模块','offset 决定新 token 的绝对位置；历史 K 不再旋转。_attention_weights 保证全屏蔽行稳定。'],['class MultiHeadAttentionWithKVCache','外置请求缓存','模块仅保存模型参数，不把一个用户的历史写进 self.cache。调用方为每个请求单独持有 past_kv。'],['past_len =','读取并检查历史','L 来自历史 K 的 token 轴；K/V 的 B/H/L/D 和 dtype/device 必须匹配当前请求。'],['q = self.q_proj','只投影本次输入','历史 token 不重复执行 Q/K/V projection。Q 只包含 Tnew 行。'],['q, k =','仅旋转新片段','Q/K 用 offset=L；历史 K 已经是旋转后的结果，V 始终保存未旋转内容。'],['if past_kv is not None:','追加 K/V','torch.cat(...,dim=-2) 沿 token 轴追加，长度从 L 变成 L+Tnew，不沿 head 或 feature 轴拼接。'],['query_pos =','矩形因果遮罩','第 i 行的新 Query 绝对位置为 L+i。Key j>L+i 是未来，必须屏蔽；只用左上角 Tnew×(L+Tnew) 三角阵会错位。'],['scores =','计算与返回','得分为 (B,H,Tnew,L+Tnew)。返回 present cache 给下一次调用；推理使用 eval() 与 torch.no_grad()。']],
    example:'layer = MultiHeadAttentionWithKVCache(8, 2).eval()\nx = torch.randn(1, 5, 8)\nwith torch.no_grad():\n    full, _, _ = layer(x)\n    prefix, _, cache = layer(x[:, :3])\n    suffix, weights, cache = layer(x[:, 3:], cache)\nassert torch.allclose(full[:, 3:], suffix, atol=1e-6)\nassert weights.shape == (1, 2, 2, 5)',
    pitfalls:['保存 K/V，不缓存旧 Q：下一步只需要新 Query。','生成多 token 片段仍需要 causal mask，不能因为“有缓存”就让同片段未来 token 泄漏。','教学版 cat 每次分配新张量；真实服务常用预分配或 paged cache。','缓存只是计算复用，没有跨请求共享的权限语义；请求结束后调用方释放自己的 cache。'],complexity:'单 token decode attention O(BLM)，缓存 O(BHLD)；避免历史重复投影，但不让 attention 变成常数时间。'
  },
  {
    id:'ce',group:'training',title:'多分类交叉熵 CE',source:'CE.py',symbols:['ce_loss'],library:'PyTorch',
    intro:'从未归一化 logits 直接计算 log 概率，支持类别索引标签和软标签分布。损失里的 -log 指向真实类别；本题是多分类 CE，不是 Sigmoid 的二元 BCE。',
    contract:[['logits','(B,C)','未归一化得分'],['target','(B,) int64 或 (B,C)','类别索引；或非负且每行和为 1 的分布'],['output','标量','对 batch 取 mean']],
    formulas:[String.raw`L=-\frac1B\sum_b\log\operatorname{softmax}(z_b)_{y_b}`,String.raw`L_{soft}=-\frac1B\sum_b\sum_c t_{b,c}\log p_{b,c}`],
    flow:['logits (B,C)','稳定 log_softmax','索引标签 gather ∥ 软标签加权 sum','每个样本 loss → batch mean'],
    steps:[['log_prob =','稳定对数概率','F.log_softmax 一次完成 log 与归一化，避免先 softmax 后 log 出现 log(0)。'],['if target.ndim','类别索引分支','target.unsqueeze(-1) 变为 (B,1)，gather 沿 C 轴取真实类别 logp，再 squeeze 回 (B,)。'],['elif target.shape','软标签分支','每个类别按目标分布权重贡献损失；不能 gather 一个类别代替整组分布。'],['return loss.mean','样本平均','loss 是 (B,)，最后取平均得到一个训练标量。']],
    example:'logits = torch.tensor([[0., 0., 0.]])\ntarget = torch.tensor([2])\n# ce_loss(logits,target) = log(3) ≈ 1.098612',
    pitfalls:['类别索引必须是 int64，不应静默把 1.9 转成类别 1。','不能把概率当 logits 再传给 log_softmax；那会重复归一化并改变损失。','软标签的合法分布由调用方保证；本函数校验形状，未实现 label smoothing 参数。'],complexity:'时间与中间空间 O(BC)。'
  },
  {
    id:'sft',group:'training',title:'SFT / Causal LM Loss',source:'sft.py',symbols:['causal_lm_loss','sequence_logps'],library:'PyTorch',
    intro:'Decoder 的第 t 个位置预测第 t+1 个 token，所以 logits 和 labels 要错开一位。SFT 只是选择在哪些 token 上监督：常见做法是屏蔽 prompt 和 padding，只监督回答。',
    contract:[['logits','(B,T,V)','V 是 vocabulary size，不是 hidden_dim'],['labels','(B,T) int64','有效 token id；不监督位置设 -100'],['loss','标量','所有有效 shifted token 的 CE 平均'],['sequence_logps','(B,)','按回答 mask 对 token logp 求和，供 DPO 使用']],
    formulas:[String.raw`L_{SFT}=-\frac{\sum_{b,t}m_{b,t+1}\log p(x_{b,t+1}\mid x_{b,\le t})}{\sum_{b,t}m_{b,t+1}}`],
    flow:['logits[:, :-1, :] ∥ labels[:, 1:]','prompt / padding label = -100','对齐后筛选有效监督','token CE 平均 / 回答 logp 求和'],
    steps:[['def causal_lm_loss','因果对齐接口','logits 最后一维必须是词表 V。T≥2 才能形成至少一组当前位置预测下一个标签。'],['shift_logits =','错开一位','去掉最后一个 logit，去掉第一个 label，再展平成 (B(T-1),V) 与 (B(T-1),)。不能让 token 预测自己。'],['valid =','回答监督掩码','prompt/padding 的标签是 -100。若 shift 后没有监督 token，就明确报错，不返回 NaN 或伪造 0 loss。'],['return F.cross_entropy','token 平均','这里对所有有效 token 一起取 mean，长回答会贡献更多 token；不是先对每个回答平均再对 batch 平均。'],['def sequence_logps','供偏好训练使用','辅助函数同样 shift，但按每条回答求和，得到 (B,)。负标签替成安全索引用于 gather，随后用 mask 把这些位置清零。']],
    example:'logits = torch.zeros(1, 4, 3)\nlabels = torch.tensor([[-100, -100, 1, 2]])\n# 只监督位置 2、3；causal_lm_loss = log(3)\nmask = labels >= 0\n# sequence_logps = [-2*log(3)]',
    pitfalls:['attention mask 决定能看哪些上下文，loss mask 决定哪些输出被监督，两者职责不同。','第一个回答 token 的目标必须保留，预测它的是 prompt 最后一个位置的 logit。','SFT 是训练目标与数据组织方式，本函数不包含优化器、训练循环或模板格式化。'],complexity:'log_softmax/CE 时间 O(BTV)，中间空间随 BTV。'
  },
  {
    id:'infonce',group:'training',title:'InfoNCE 对比损失',source:'InfoNCE.py',symbols:['info_nce_loss'],library:'PyTorch',
    intro:'同一个样本的两条视图为正样本，其余 batch 内样本为负样本。把每个 anchor 的相似度行当成分类 logits，正确类别就是同一下标的另一条视图。',
    contract:[['pairs','(B,2,D)','每个样本两条视图，建议 B≥2'],['temperature','正标量','控制相似度分布的尖锐程度'],['symmetric','默认 True','双向平均；False 对齐原稿的单向版本']],
    formulas:[String.raw`s_{ij}=\frac{\langle\bar z_i^{(1)},\bar z_j^{(2)}\rangle}{\tau}`,String.raw`L_{1\to2}=-\frac1B\sum_i\log\frac{e^{s_{ii}}}{\sum_j e^{s_{ij}}}`],
    flow:['两组视图 (B,D)','各自 L2 normalize','相似度 (B,B)；对角线为正样本','CE 对角类别 → 可选双向平均'],
    steps:[['z1 =','归一化','每个向量按最后一维做 L2 normalize，之后点积等价于余弦相似度。'],['scores =','构建 B×B 分类任务','行 i 是 anchor i，对角线 i 是对应正样本，其他列是 in-batch negatives；temperature 必须大于 0。'],['target =','正确类别下标','arange(B) 表示第 i 行的正确列就是 i；在同一 device 创建标签。'],['left =','稳定计算损失','cross_entropy 等价于 -对角线 logit + logsumexp(整行)。symmetric=True 再用转置矩阵计算反方向。']],
    example:'pairs = torch.tensor([[[1.,0.],[1.,0.]],\n                      [[0.,1.],[0.,1.]]])\n# temperature=1 时，loss=log(1+exp(-1))≈0.313262',
    pitfalls:['分母包括正样本，不是只对负样本求和。','B=1 时没有负样本，损失为 0，不能学到有效区分。','批次内如果存在同义或重复样本，它们可能被误当负样本，数据组织同样重要。'],complexity:'时间 O(B²D)，相似度空间 O(B²)。'
  },
  {
    id:'kl',group:'training',title:'KL：精确值与 k1 / k2 / k3',source:'KL.py',symbols:['sampled_kl','categorical_kl'],library:'PyTorch',
    intro:'先区分完整分布的 KL(p∥q) 和只拿到采样 token logp 的估计器。本题明确 p=当前策略、q=参考策略，token 假定采样自 p；换采样方向就不能沿用同一解释。',
    contract:[['logp / ref_logp','同形状','采样 token 在当前 / 参考策略下的 log 概率'],['method','k1 / k2 / k3','返回逐 token 值，不在函数里平均'],['logits_p / logits_q','(...,V)','精确 KL 返回 (...)，两分布支持须一致']],
    formulas:[String.raw`\mathrm{KL}(p\Vert q)=\mathbb E_{x\sim p}[\log p(x)-\log q(x)]`,String.raw`\ell=\log(q/p),\quad k_1=-\ell,\quad k_2=\ell^2/2,\quad k_3=e^\ell-1-\ell`],
    flow:['完整 logits → p 加权 logp−logq','采样 token → log(q/p)','选择 k1 / k2 / k3','按有效 token mask 汇总'],
    steps:[['logr =','明确 log ratio 方向','ref_logp.detach()-logp 是 log(q/p)。参考策略固定，detach 防止更新它。'],['if method ==','k1 / k2 / k3','k1 单个样本可为负；k2 非负但一般有偏，仅局部近似；k3 使用 expm1 提高小差值精度。错误 method 明确报错。'],['def categorical_kl','精确 KL','能够得到完整词表时，按 p 的概率加权 logp-logq，再在词表轴求和。这里两份 logits 都可求导；若 q 是冻结参考，上游 detach。']],
    example:'p = torch.tensor([[0.7, 0.3]])\nq = torch.tensor([[0.5, 0.5]])\n# categorical_kl(p.log(),q.log())≈[0.082283]\n# p=q 时：精确 KL 和所有估计器都为 0',
    pitfalls:['k1/k3 的期望结论依赖 x∼p 及支持条件；若 rollout 来自旧策略，有限样本均值不能直接称作精确 KL。','估计值的期望与把样本视为固定后得到的梯度，是不同问题；这里演示估计器，不替代完整 RL 推导。','k3 的 exp 在极端概率比下仍可能溢出；训练应监控 log ratio。'],complexity:'采样估计 O(N)，精确词表 KL O(NV)。'
  },
  {
    id:'dpo',group:'training',title:'DPO 偏好优化',source:'DPO.py',symbols:['sequence_logps','dpo_loss'],library:'PyTorch',
    intro:'同一个 prompt 配一条 chosen 和一条 rejected。比较当前策略相对固定参考策略的偏好差，再用 logistic loss 让 chosen 的相对优势变大；不需要在此函数内训练 reward model。',
    contract:[['四份 logp','各 (B,)','chosen / rejected 的回答 token logp 之和'],['beta','正标量','调节参考约束与偏好 logit 的尺度'],['output','标量','batch 平均 logistic loss']],
    formulas:[String.raw`m=(\log\pi_\theta(y_w|x)-\log\pi_{ref}(y_w|x))-(\log\pi_\theta(y_l|x)-\log\pi_{ref}(y_l|x))`,String.raw`L_{DPO}=-\mathbb E[\log\sigma(\beta m)]`],
    flow:['同 prompt 的 chosen / rejected','回答 token logp 求和','各减参考 logp','偏好 margin → -logsigmoid'],
    steps:[['def sequence_logps','取得回答 logp','辅助函数做因果 shift，只求回答 token 的 logp 之和；chosen/rejected 与参考策略必须用相同模板和 mask。'],['def dpo_loss','四组配对值','所有输入必须是同长度 (B,)，不能一边用序列和、一边用 token 平均。'],['chosen_ratio =','相对参考的优势','chosen、rejected 都减去各自参考 logp。参考端 detach，当前策略端保留梯度。'],['margin =','偏好差','margin>0 表示当前策略比参考策略更偏向 chosen；不是要求 chosen 原始 logp 必须大于 0。'],['return -F.logsigmoid','稳定 logistic loss','不要先 sigmoid 再 log。margin 增大时损失减小；margin=0 时损失 log(2)。']],
    example:'chosen = torch.tensor([-2.], requires_grad=True)\nrejected = torch.tensor([-3.], requires_grad=True)\nref_chosen = torch.tensor([-2.])\nref_rejected = torch.tensor([-3.])\n# 当前=参考，margin=0，loss=log(2)',
    pitfalls:['reference 不是 old rollout policy：DPO 的参考是固定锚点；PPO/GRPO 的 old policy 用于 importance ratio。','本题是基本 DPO，未实现 IPO、长度归一化、label smoothing 或其他变体。','beta 的作用不能简化为“越大越好”，需要结合训练目标和数据质量选择。'],complexity:'给定序列 logp 后 O(B)；主要计算成本在策略与参考模型前向。'
  },
  {
    id:'grpo',group:'training',title:'GRPO 组相对策略优化',source:'GRPO.py',symbols:['grpo_loss'],library:'PyTorch',
    intro:'一个 prompt 生成 G 条回答，在组内标准化奖励得到 advantage，再以 token 级 clipped importance ratio 优化策略并加参考 KL 项。本题明确采用“每条回答先长度平均，再对全部回答平均”的教学版本。',
    contract:[['rewards','(B,G)，G≥2','每条回答的奖励'],['logp / old_logp / ref_logp','(B,G,T)','当前、rollout 旧策略、固定参考的 token logp'],['completion_mask','(B,G,T)','有效回答 token，所有回答至少一个有效 token'],['loss','标量','ratio clip + k3 KL regularization']],
    formulas:[String.raw`A_{b,i}=\frac{r_{b,i}-\operatorname{mean}_j r_{b,j}}{\operatorname{std}_j r_{b,j}+\epsilon}`,String.raw`\rho_t=e^{\log\pi_\theta-\log\pi_{old}},\quad J_t=\min(\rho_tA,\operatorname{clip}(\rho_t,1-\varepsilon,1+\varepsilon)A)`,String.raw`L=\frac1{BG}\sum_{b,i}\frac1{\sum_t m_{b,i,t}}\sum_t m_{b,i,t}(-J_{b,i,t}+\beta k_{3,b,i,t})`],
    flow:['每个 prompt 的 G 条回答奖励','组内 mean / std → 每回答 advantage','当前 / old token logp → ratio clip','reference KL + token mask','每条长度平均 → 所有回答平均'],
    steps:[['mask =','有效 token 与长度','prompt、padding 不纳入损失。空回答明确报错；masked logp 先替为 0，避免无效位置的 NaN/inf 污染 exp。'],['reward =','固定数据与组内标准化','reward detach；std(unbiased=False) 用组内总体标准差。相同奖励时 advantage=0，本实现仍可能保留 KL 项。'],['advantage = advantage.unsqueeze','回答优势广播到 token','(B,G)→(B,G,1)，同一回答的全部有效 token 共享同一个 advantage。'],['current =','隔离梯度','当前 logp 可求导；old/ref detach，不能让优化器顺手更新 rollout 基线或参考模型。'],['ratio =','Importance ratio 与 clip','ratio 是 current 相对 old，不是 current 相对 reference。正负 advantage 都用 minimum，而不是对 logp 本身裁剪。'],['delta =','参考 KL 正则','delta=ref-current；expm1(delta)-delta 是 k3 token 估计值，本题遵循该常见代理目标。'],['return (token_loss','明确 reduction','先按每条回答有效长度平均，再对 BG 条回答平均。与把全部 token 一起平均并不等价。']],
    example:'rewards = torch.tensor([[1., 3.]])\nlogp = torch.full((1,2,3), -1., requires_grad=True)\nmask = torch.ones_like(logp, dtype=torch.bool)\nloss = grpo_loss(rewards, logp, logp.detach(), logp.detach(), mask)\nloss.backward()\n# 初始 loss 可为 0，但梯度不为 0：高奖励回答提升概率，低奖励降低',
    pitfalls:['本题是明确的一种 GRPO 写法；Dr.GRPO 等变体会修改长度归约或标准化，不存在所有框架完全相同的唯一实现。','不训练 critic，并不意味着没有基线：组内平均奖励就是相对比较基准。','old policy 用于 rollout ratio，reference 用于 KL，两者不要混淆。','本函数不包含采样、reward 计算或优化器；需要完整训练循环才能运行强化学习训练。'],complexity:'损失计算 O(BGT)，额外张量 O(BGT)；模型前向与采样另计。'
  },
  {
    id:'bpe',group:'systems',title:'BPE 分词器（词级教学版）',source:'BPE.py',symbols:['BPETokenizer'],library:'Python 标准库',
    intro:'从字符和词尾符号开始，按语料频次反复合并最高频相邻 pair；编码时按学习顺序回放 merge rules。本题补齐确定性、重复 fit 清空、未知字符与 decode。',
    contract:[['corpus','非空字符串','split() 按空白预分词'],['vocab_size','整数上限','必须容纳 <unk>、字符与 </w>'],['encode / decode','str → List[int] → str','未知字符转 <unk>，decode 规范化空白']],
    formulas:[],flow:['词频 Counter','字符 + </w> 初始词表','统计加权相邻 pair → 最高频合并 ↺','按 merge 顺序 encode → id → decode'],
    steps:[['class BPETokenizer','状态与词尾','vocab 保存 token→id，merges 保存有顺序的 pair；</w> 保留词边界，避免跨词合并。'],['def merge','非重叠替换','从左到右扫描。例如 aaa 合并 aa 只能先得到 aa,a，不能重叠使用同一个字符。'],['def fit','词频与初始字母表','Counter(corpus.split()) 保存词频；pair 计数必须乘这个频率。初始字母表排序，保证 id 可复现。'],['self.vocab =','重新训练清空状态','每次 fit 重建 vocab 与 merges，防止旧语料规则残留；保留 <unk>，并检查 vocab_size 下限。'],['while len(self.vocab)','贪心合并循环','每轮重算 pair 频次；同频按字典序选取。合并后相同符号序列的词频需要累加，不可覆盖。'],['def encode','回放规则','把每个词拆成字符与 </w>，按训练时的 merge 顺序回放；不是按当前输入的频率重新训练。'],['def decode','逆词表与词边界','把 id 映回 token 拼接，再将 </w> 换为空格。原始连续空格与换行不保留，未知字符无法无损恢复。']],
    example:'tokenizer = BPETokenizer(vocab_size=24).fit("low lower lowest low")\nids = tokenizer.encode("low lowest")\nassert tokenizer.decode(ids) == "low lowest"\n# 相同 corpus/vocab_size 得到相同 vocab 与 merges',
    pitfalls:['这是词级字符 BPE，不是 GPT-2 的 byte-level BPE；没有 byte fallback、特殊 token 协议或完整 Unicode 预分词。','vocab_size 是上限；无可合并 pair 时可提前结束，不要求实际词表一定达到上限。','训练 tie-break 固定，不表示和其他库训练出的词表完全一致。'],complexity:'设 K 次合并、每轮扫描 S 个符号，朴素训练约 O(KS)；编码按规则回放约 O(KStext)。'
  },
  {
    id:'react',group:'systems',title:'ReAct 最小执行器',source:'react_agent.py',symbols:['react_agent'],library:'Python 标准库',
    intro:'模型提出 action，应用执行已注册工具，把 observation 回填，再由模型选择继续或 finish。本题把 llm 作为显式依赖，采用 dict 协议，让整个循环可以用 mock 在本地运行。',
    contract:[['llm','可调用函数','输入 {question,history}，返回 {tool,input}'],['tools','名称→函数字典','只执行白名单注册函数'],['max_steps','正整数','限制模型调用次数'],['return','str','finish 答案；或达到次数上限提示']],
    formulas:[],flow:['question + history → llm','校验 action 协议','finish → 返回 ∥ 工具白名单执行','Observation(ok/result/error) → history ↺','达到 max_steps → 停止'],
    steps:[['if max_steps','预算与依赖','不依赖未定义的全局 llm。max_steps 限制模型调用次数，包含 finish 的那次调用。'],['action = llm','模型只提出意图','返回 dict，而不是直接执行 Python 字符串；应用持有工具函数与实际执行权。'],['if not isinstance','协议验证','action 必须是 dict，tool 必须是字符串；finish 的 input 必须是答案字符串。'],['if action["tool"] not in tools','工具白名单','不使用 eval，不执行未注册名称；未知工具和工具异常转换成 error observation，供下一轮修正。'],['result = tools','执行与反馈','工具接收一个 input 对象，返回值包装成 ok/result；后续模型看到完整 action/observation 记录。'],['history.append','反馈循环','每轮把结果追加到 history，下一轮继续。达到上限返回未完成提示，不无限循环。']],
    example:'def mock_llm(state):\n    if not state["history"]:\n        return {"tool":"double", "input":3}\n    return {"tool":"finish", "input":"结果是 6"}\nassert react_agent("3 的两倍？", mock_llm, {"double":lambda x:x*2}) == "结果是 6"',
    pitfalls:['教学执行器不包含联网模型适配器、JSON parser、鉴权、超时和审计；真实系统还需在工具层补齐。','不要求暴露模型内部推理文本；用结构化 action 与 observation 即可表现任务循环。','模型服务本身抛出的异常在此版本向调用方传播；工具与协议错误才作为 observation 反馈。'],complexity:'最多 max_steps 次模型调用；时间由模型与工具决定，历史随步骤增长。',related:'react.html'
  }
];
