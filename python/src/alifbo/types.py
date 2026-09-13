"""Public result types (mirrors ``src/types.ts``)."""

from __future__ import annotations

from dataclasses import dataclass
from typing import Literal, Optional, Tuple

Alphabet = Literal["cyrillic", "old-latin", "new-latin", "mixed", "unknown"]


@dataclass(frozen=True)
class Warning:  # Shadows the builtin on purpose: mirrors the TypeScript name.
    """A lossy or ambiguous conversion choice.

    ``index`` and ``length`` are Python ``str`` (code point) offsets. The TypeScript
    library reports UTF-16 code-unit offsets instead; the two only differ for text
    containing characters outside the Basic Multilingual Plane (for example emoji).
    """

    index: int
    length: int
    rule: str
    message: str
    alternatives: Optional[Tuple[str, ...]] = None


@dataclass(frozen=True)
class ConversionResult:
    """Converted text plus every warning produced while converting it."""

    text: str
    warnings: Tuple[Warning, ...] = ()


@dataclass(frozen=True)
class AlphabetDetection:
    """Best-effort alphabet classification with a confidence between zero and one."""

    alphabet: Alphabet
    confidence: float
