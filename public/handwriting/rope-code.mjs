// Executable teaching versions of the supplied-style RoPE implementation.
export const numpyCode = `import numpy as np
from typing import List, Optional

class Solution:
    def apply_rope(
        self,
        x: List[List[float]],
        positions: Optional[List[float]] = None,
        base: float = 10000.0,
    ) -> List[List[float]]:
        X = np.asarray(x, dtype=np.float64)
        if X.ndim != 2:
            raise ValueError("x must be a 2D matrix")
        T, D = X.shape
        if D % 2 != 0:
            raise ValueError("D must be even for pairwise rotation")
        if base <= 1:
            raise ValueError("base must be greater than 1")

        if positions is None:
            pos = np.arange(T, dtype=np.float64)
        else:
            pos = np.asarray(positions, dtype=np.float64)
            if pos.shape != (T,):
                raise ValueError("positions must have shape (T,)")

        inv_freq = 1.0 / (base ** (np.arange(0, D, 2) / D))
        angles = pos[:, None] * inv_freq[None, :]
        cos = np.cos(angles)
        sin = np.sin(angles)

        even = X[:, 0::2]
        odd = X[:, 1::2]
        out = np.empty_like(X)
        out[:, 0::2] = even * cos - odd * sin
        out[:, 1::2] = even * sin + odd * cos
        return out.tolist()`;

export const torchCode = `import torch
from typing import List, Optional

class Solution:
    def apply_rope(
        self,
        x: List[List[float]],
        positions: Optional[List[float]] = None,
        base: float = 10000.0,
    ) -> List[List[float]]:
        X = torch.tensor(x, dtype=torch.float64)
        if X.ndim != 2:
            raise ValueError("x must be a 2D matrix")
        T, D = X.shape
        if D % 2 != 0:
            raise ValueError("D must be even for pairwise rotation")
        if base <= 1:
            raise ValueError("base must be greater than 1")

        if positions is None:
            pos = torch.arange(T, dtype=torch.float64)
        else:
            pos = torch.tensor(positions, dtype=torch.float64)
            if pos.shape != (T,):
                raise ValueError("positions must have shape (T,)")

        inv_freq = 1.0 / (base ** (torch.arange(0, D, 2) / D))
        angles = pos[:, None] * inv_freq[None, :]
        cos = torch.cos(angles)
        sin = torch.sin(angles)

        even = X[:, 0::2]
        odd = X[:, 1::2]
        out = torch.empty_like(X)
        out[:, 0::2] = even * cos - odd * sin
        out[:, 1::2] = even * sin + odd * cos
        return out.tolist()`;
