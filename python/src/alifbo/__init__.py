"""Uzbek transliteration between Cyrillic, old Latin, and the 2026 Latin alphabet."""

from __future__ import annotations

from .cyrillic import from_cyrillic, to_cyrillic
from .detect import detect_alphabet
from .latin import to_new_latin, to_old_latin
from .normalize import normalize_apostrophes, normalize_confusables
from .search import fold_search_key, fold_search_key_loose
from .types import Alphabet, AlphabetDetection, ConversionResult, Warning

__version__ = "0.5.0"

__all__ = [
    "Alphabet",
    "AlphabetDetection",
    "ConversionResult",
    "Warning",
    "__version__",
    "detect_alphabet",
    "fold_search_key",
    "fold_search_key_loose",
    "from_cyrillic",
    "normalize_apostrophes",
    "normalize_confusables",
    "to_cyrillic",
    "to_new_latin",
    "to_old_latin",
]
