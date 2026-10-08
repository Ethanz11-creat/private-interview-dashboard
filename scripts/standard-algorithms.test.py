import importlib.util
import unittest

import torch


SPEC = importlib.util.spec_from_file_location(
    "standard_algorithms", "public/handwriting/standard_algorithms.py"
)
MODULE = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(MODULE)


class StandardAlgorithmsTest(unittest.TestCase):
    def test_stable_elementwise_ops(self):
        self.assertTrue(torch.isfinite(torch.tensor(MODULE.sigmoid([-1000, 0, 1000]))).all())
        self.assertAlmostEqual(float(MODULE.sigmoid([0])[0]), 0.5)
        probs = MODULE.softmax([[1000.0, 1001.0, 1002.0]])
        self.assertAlmostEqual(float(probs.sum()), 1.0, places=12)

    def test_norms_and_swiglu_shapes(self):
        x = torch.randn(2, 3, 8)
        self.assertEqual(MODULE.LayerNorm(8)(x).shape, x.shape)
        self.assertEqual(MODULE.RMSNorm(8)(x).shape, x.shape)
        self.assertEqual(MODULE.SwiGLU(8, 16)(x).shape, x.shape)

    def test_rope_preserves_shape_and_offset(self):
        torch.manual_seed(0)
        rope = MODULE.RoPEEmbedding(4)
        x = torch.randn(1, 2, 5, 4)
        full = rope(x)
        self.assertEqual(full.shape, x.shape)
        self.assertTrue(torch.allclose(full[:, :, 3:], rope(x[:, :, 3:], offset=3), atol=1e-6))

    def test_gqa_and_attention_shapes(self):
        x = torch.randn(2, 4, 16)
        self.assertEqual(MODULE.MultiHeadAttention(16, 4)(x).shape, x.shape)
        self.assertEqual(MODULE.GroupedQueryAttention(16, 4, 2)(x).shape, x.shape)
        with self.assertRaises(ValueError):
            MODULE.GroupedQueryAttention(16, 3, 2)

    def test_kv_cache_matches_full_decode(self):
        torch.manual_seed(1)
        layer = MODULE.MultiHeadAttentionWithKVCache(8, 2).eval()
        x = torch.randn(1, 5, 8)
        with torch.no_grad():
            full, _, _ = layer(x)
            prefix, _, cache = layer(x[:, :3])
            suffix, weights, _ = layer(x[:, 3:], cache)
        self.assertTrue(torch.allclose(full[:, 3:], suffix, atol=1e-6))
        self.assertEqual(tuple(weights.shape), (1, 2, 2, 5))

    def test_losses(self):
        logits = torch.zeros(1, 3)
        self.assertAlmostEqual(float(MODULE.ce_loss(logits, torch.tensor([2]))), torch.log(torch.tensor(3.)).item(), places=6)
        lm_logits = torch.zeros(1, 4, 3)
        labels = torch.tensor([[-100, -100, 1, 2]])
        self.assertAlmostEqual(float(MODULE.causal_lm_loss(lm_logits, labels)), torch.log(torch.tensor(3.)).item(), places=6)
        value = MODULE.dpo_loss(torch.tensor([-2.]), torch.tensor([-3.]), torch.tensor([-2.]), torch.tensor([-3.]))
        self.assertAlmostEqual(float(value), torch.log(torch.tensor(2.)).item(), places=6)
        rewards = torch.tensor([[1., 3.]])
        tokens = torch.full((1, 2, 3), -1., requires_grad=True)
        loss = MODULE.grpo_loss(rewards, tokens, tokens.detach(), tokens.detach(), torch.ones_like(tokens, dtype=torch.bool))
        loss.backward()
        self.assertTrue(torch.isfinite(loss))

    def test_bpe_and_react(self):
        tokenizer = MODULE.BPETokenizer(24).fit("low lower lowest low")
        ids = tokenizer.encode("low lowest")
        self.assertEqual(tokenizer.decode(ids), "low lowest")

        calls = []
        def llm(state):
            calls.append(state)
            return {"tool": "double", "input": 3} if not state["history"] else {"tool": "finish", "input": "结果是 6"}

        result = MODULE.react_agent("3 的两倍？", llm, {"double": lambda value: value * 2})
        self.assertEqual(result, "结果是 6")
        self.assertEqual(len(calls), 2)


if __name__ == "__main__":
    unittest.main(verbosity=2)
