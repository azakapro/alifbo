"""Alphabet-independent search keys (mirrors ``src/search.ts``)."""

from __future__ import annotations

import unicodedata

from .case import lower_text
from .cyrillic import from_cyrillic
from .latin import to_new_latin
from .normalize import nfc, normalize_confusables


def fold_search_key(text: str) -> str:
    """Produce a canonical, NFC, locale-independent lowercase search key from any alphabet."""
    cyrillic_converted = from_cyrillic(text).text
    return nfc(lower_text(normalize_confusables(to_new_latin(cyrillic_converted).text)))


def fold_search_key_loose(text: str) -> str:
    """Produce a typo-tolerant key that also strips diacritics and may merge distinct words."""
    decomposed = unicodedata.normalize("NFD", fold_search_key(text))
    return nfc("".join(c for c in decomposed if unicodedata.category(c)[0] != "M"))
