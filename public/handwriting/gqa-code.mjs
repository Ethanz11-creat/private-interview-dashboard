// Executable teaching versions, adapted from the supplied solutions.
export const numpyCode = `import numpy as np
from typing import List

class Solution:
    def grouped_query_attention(
        self, X: List[List[float]],
        W_Q: List[List[float]], b_Q: List[float],
        W_K: List[List[float]], b_K: List[float],
        W_V: List[List[float]], b_V: List[float],
        h_q: int, h_k: int,
        W_O: List[List[float]], b_O: List[float],
    ) -> List[List[float]]:
        Xn = np.asarray(X, dtype=np.float64)
        WQ = np.asarray(W_Q, dtype=np.float64)
        WK = np.asarray(W_K, dtype=np.float64)
        WV = np.asarray(W_V, dtype=np.float64)
        WO = np.asarray(W_O, dtype=np.float64)
        bQ = np.asarray(b_Q, dtype=np.float64)
        bK = np.asarray(b_K, dtype=np.float64)
        bV = np.asarray(b_V, dtype=np.float64)
        bO = np.asarray(b_O, dtype=np.float64)

        T, d_model = Xn.shape
        d_k = d_model // h_q
        group_size = h_q // h_k
        inv_sqrt = 1.0 / np.sqrt(d_k)

        Q = Xn @ WQ + bQ
        K = Xn @ WK + bK
        V = Xn @ WV + bV

        Qh = Q.reshape(T, h_q, d_k).transpose(1, 0, 2)
        Kh = K.reshape(T, h_k, d_k).transpose(1, 0, 2)
        Vh = V.reshape(T, h_k, d_k).transpose(1, 0, 2)

        Hh = np.empty((h_q, T, d_k), dtype=np.float64)
        for i in range(h_q):
            g = i // group_size
            Qi = Qh[i]
            Ki = Kh[g]
            Vi = Vh[g]

            scores = (Qi @ Ki.T) * inv_sqrt
            scores = scores - scores.max(axis=1, keepdims=True)
            attn = np.exp(scores)
            attn = attn / attn.sum(axis=1, keepdims=True)
            Hh[i] = attn @ Vi

        H = Hh.transpose(1, 0, 2).reshape(T, d_model)
        O = H @ WO + bO
        return O.tolist()`;

export const torchCode = `import math
import torch
from typing import List

class Solution:
    def grouped_query_attention(
        self, X: List[List[float]],
        W_Q: List[List[float]], b_Q: List[float],
        W_K: List[List[float]], b_K: List[float],
        W_V: List[List[float]], b_V: List[float],
        h_q: int, h_k: int,
        W_O: List[List[float]], b_O: List[float],
    ) -> List[List[float]]:
        X = torch.tensor(X, dtype=torch.float64)
        W_Q = torch.tensor(W_Q, dtype=torch.float64)
        b_Q = torch.tensor(b_Q, dtype=torch.float64)
        W_K = torch.tensor(W_K, dtype=torch.float64)
        b_K = torch.tensor(b_K, dtype=torch.float64)
        W_V = torch.tensor(W_V, dtype=torch.float64)
        b_V = torch.tensor(b_V, dtype=torch.float64)
        W_O = torch.tensor(W_O, dtype=torch.float64)
        b_O = torch.tensor(b_O, dtype=torch.float64)

        T, d_model = X.shape
        d_k = d_model // h_q
        group_size = h_q // h_k

        Q = X @ W_Q + b_Q
        K = X @ W_K + b_K
        V = X @ W_V + b_V

        Qh = Q.reshape(T, h_q, d_k).transpose(0, 1)
        Kh = K.reshape(T, h_k, d_k).transpose(0, 1)
        Vh = V.reshape(T, h_k, d_k).transpose(0, 1)

        Kh = Kh.repeat_interleave(group_size, dim=0)
        Vh = Vh.repeat_interleave(group_size, dim=0)

        scores = (Qh @ Kh.transpose(-2, -1)) / math.sqrt(d_k)
        attn = torch.softmax(scores, dim=-1)
        Hh = attn @ Vh

        H = Hh.transpose(0, 1).reshape(T, d_model)
        O = H @ W_O + b_O
        return O.tolist()`;
