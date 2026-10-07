// The supplied interfaces and calculations, with compact argument formatting.
export const numpyCode = `import numpy as np
from typing import List

class Solution:
    def cross_attention(
        self, X_Q: List[List[float]], X_K: List[List[float]],
        W_Q: List[List[float]], b_Q: List[float],
        W_K: List[List[float]], b_K: List[float],
        W_V: List[List[float]], b_V: List[float],
        W_O: List[List[float]], b_O: List[float],
    ) -> List[List[float]]:
        X_Q = np.asarray(X_Q, dtype=np.float64)
        X_K = np.asarray(X_K, dtype=np.float64)
        W_Q = np.asarray(W_Q, dtype=np.float64)
        b_Q = np.asarray(b_Q, dtype=np.float64)
        W_K = np.asarray(W_K, dtype=np.float64)
        b_K = np.asarray(b_K, dtype=np.float64)
        W_V = np.asarray(W_V, dtype=np.float64)
        b_V = np.asarray(b_V, dtype=np.float64)
        W_O = np.asarray(W_O, dtype=np.float64)
        b_O = np.asarray(b_O, dtype=np.float64)

        Q = X_Q @ W_Q + b_Q
        K = X_K @ W_K + b_K
        V = X_K @ W_V + b_V

        d_k = K.shape[1]
        S = Q @ K.T / np.sqrt(d_k)

        S = S - np.max(S, axis=-1, keepdims=True)
        exp_S = np.exp(S)
        A = exp_S / np.sum(exp_S, axis=-1, keepdims=True)

        H = A @ V
        O = H @ W_O + b_O
        return O.tolist()`;

export const torchCode = `import math
import torch
from typing import List

class Solution:
    def cross_attention(
        self, X_Q: List[List[float]], X_K: List[List[float]],
        W_Q: List[List[float]], b_Q: List[float],
        W_K: List[List[float]], b_K: List[float],
        W_V: List[List[float]], b_V: List[float],
        W_O: List[List[float]], b_O: List[float],
    ) -> List[List[float]]:
        X_Q = torch.tensor(X_Q, dtype=torch.float64)
        X_K = torch.tensor(X_K, dtype=torch.float64)
        W_Q = torch.tensor(W_Q, dtype=torch.float64)
        b_Q = torch.tensor(b_Q, dtype=torch.float64)
        W_K = torch.tensor(W_K, dtype=torch.float64)
        b_K = torch.tensor(b_K, dtype=torch.float64)
        W_V = torch.tensor(W_V, dtype=torch.float64)
        b_V = torch.tensor(b_V, dtype=torch.float64)
        W_O = torch.tensor(W_O, dtype=torch.float64)
        b_O = torch.tensor(b_O, dtype=torch.float64)

        Q = X_Q @ W_Q + b_Q
        K = X_K @ W_K + b_K
        V = X_K @ W_V + b_V

        d_k = K.shape[1]
        S = (Q @ K.T) / math.sqrt(d_k)
        A = torch.softmax(S, dim=-1)

        H = A @ V
        O = H @ W_O + b_O
        return O.tolist()`;
