"""Punto de entrada: `uv run python -m ejecutor <comando>`."""

from __future__ import annotations

import sys

from .cli import principal

if __name__ == '__main__':
    sys.exit(principal())
