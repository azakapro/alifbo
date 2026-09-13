"""NFC, confusable, and apostrophe normalization (mirrors ``src/normalize.ts``)."""

from __future__ import annotations

import unicodedata
from typing import List, NamedTuple, Tuple

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


def utf16_length(text: str) -> int:
    return len(text) + sum(1 for character in text if ord(character) > 0xFFFF)


def unit_length(character: str, utf16: bool) -> int:
    return 2 if utf16 and ord(character) > 0xFFFF else 1


def text_units(text: str, utf16: bool) -> int:
    """Length of ``text`` in offset units: UTF-16 code units or code points."""
    return utf16_length(text) if utf16 else len(text)


class MappedText(NamedTuple):
    """Text paired with the source offset of each offset unit (see ``src/normalize.ts``).

    ``origins`` holds one entry per offset unit of ``text`` (UTF-16 code units in parity
    mode, code points otherwise) plus a trailing entry holding the source end, so
    ``origins[index + length]`` is always defined for an in-range warning.
    """

    text: str
    origins: List[int]


def source_range(origins: List[int], index: int, length: int) -> Tuple[int, int]:
    """Translate a range in mapped text back to ``(index, length)`` in the source text."""
    last = origins[-1]
    start = origins[index] if 0 <= index < len(origins) else last
    end_index = index + length
    end = origins[end_index] if 0 <= end_index < len(origins) else last
    return start, max(end - start, 1 if length > 0 else 0)


def _continues_chunk(character: str) -> bool:
    code = ord(character)
    return (
        unicodedata.category(character)[0] == "M"
        or 0x1160 <= code <= 0x11FF
        or 0xD7B0 <= code <= 0xD7FF
    )


def _nfc_mapped(text: str, utf16: bool) -> MappedText:
    whole = nfc(text)
    output: List[str] = []
    origins: List[int] = []
    chunk_start = 0  # index into ``text``
    chunk_units = 0  # the same position in offset units
    units = 0
    for index, character in enumerate(text):
        if index > 0 and not _continues_chunk(character):
            normalized = nfc(text[chunk_start:index])
            output.append(normalized)
            origins.extend([chunk_units] * text_units(normalized, utf16))
            chunk_start, chunk_units = index, units
        units += unit_length(character, utf16)
    if chunk_start < len(text):
        normalized = nfc(text[chunk_start:])
        output.append(normalized)
        origins.extend([chunk_units] * text_units(normalized, utf16))
    origins.append(units)
    # Chunked normalization equals whole-string NFC for all realistic input; if a rare
    # cross-chunk composition occurs, keep the exact text and fall back to clamped offsets.
    if "".join(output) != whole:
        return MappedText(whole, [min(unit, units) for unit in range(text_units(whole, utf16) + 1)])
    return MappedText(whole, origins)


def prepare_text_mapped(text: str, utf16: bool) -> MappedText:
    """``prepare_text`` with source offsets. Confusable and apostrophe folding are one-to-one."""
    normalized = _nfc_mapped(text, utf16)
    prepared = prepare_text(text)
    prepared_units = text_units(prepared, utf16)
    if prepared_units != text_units(normalized.text, utf16):
        source_units = text_units(text, utf16)
        return MappedText(prepared, [min(unit, source_units) for unit in range(prepared_units + 1)])
    return MappedText(prepared, normalized.origins)
