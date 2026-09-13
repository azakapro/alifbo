"""NFC, confusable, and apostrophe normalization (mirrors ``src/normalize.ts``)."""

from __future__ import annotations

import unicodedata

_APOSTROPHE_LIKE = frozenset(
    (
        "ʻ",  # MODIFIER LETTER TURNED COMMA
        "ʼ",  # MODIFIER LETTER APOSTROPHE
        "'",
        "‘",
        "’",
        "`",
        "´",
        "′",
        "＇",
    )
)
_LETTER_MODIFIER_PREDECESSORS = frozenset(("o", "O", "g", "G"))
_CONFUSABLES = {"ș": "ş", "Ș": "Ş"}


def nfc(text: str) -> str:
    return unicodedata.normalize("NFC", text)


def normalize_confusables(text: str) -> str:
    """NFC-normalize text and fold known visual confusables to their canonical Uzbek forms."""
    return nfc("".join(_CONFUSABLES.get(character, character) for character in nfc(text)))


def normalize_apostrophes(text: str) -> str:
    """Collapse apostrophe-like characters to U+02BB after o/g and U+02BC elsewhere."""
    source = normalize_confusables(text)
    result = []
    previous = ""
    for character in source:
        if character in _APOSTROPHE_LIKE:
            result.append("ʻ" if previous in _LETTER_MODIFIER_PREDECESSORS else "ʼ")
        else:
            result.append(character)
        previous = character
    return nfc("".join(result))


def prepare_text(text: str) -> str:
    return normalize_apostrophes(normalize_confusables(nfc(text)))
