"""Cyrillic <-> new Latin conversion with warnings (mirrors ``src/cyrillic.ts``)."""

from __future__ import annotations

import re
import unicodedata
from typing import Iterable, List, Mapping, Optional, Sequence, Tuple

from .case import first_case, is_upper, lower_char, upper_text
from .latin import old_latin_core, to_new_latin_mapped
from .normalize import nfc, prepare_text_mapped, source_range, unit_length
from .pipeline import Options, apply_exceptions, make_options, map_segments
from .types import ConversionResult, Warning

_DIRECT_FROM_CYRILLIC = {
    "а": "a",
    "б": "b",
    "в": "v",
    "г": "g",
    "д": "d",
    "ж": "j",
    "з": "z",
    "и": "i",
    "й": "y",
    "к": "k",
    "л": "l",
    "м": "m",
    "н": "n",
    "о": "o",
    "п": "p",
    "р": "r",
    "с": "s",
    "т": "t",
    "у": "u",
    "ф": "f",
    "х": "x",
    "ч": "ç",
    "ш": "ş",
    "ы": "i",
    "э": "e",
    "ў": "ö",
    "қ": "q",
    "ғ": "ğ",
    "ҳ": "h",
}

_DIRECT_TO_CYRILLIC = {
    "a": "а",
    "b": "б",
    "v": "в",
    "g": "г",
    "d": "д",
    "j": "ж",
    "z": "з",
    "i": "и",
    "y": "й",
    "k": "к",
    "l": "л",
    "m": "м",
    "n": "н",
    "o": "о",
    "p": "п",
    "r": "р",
    "s": "с",
    "t": "т",
    "u": "у",
    "f": "ф",
    "x": "х",
    "ç": "ч",
    "ş": "ш",
    "ö": "ў",
    "q": "қ",
    "ğ": "ғ",
    "h": "ҳ",
}

_CYRILLIC_VOWELS = frozenset(("а", "е", "ё", "и", "о", "у", "ў", "э", "ю", "я"))
_LATIN_VOWELS = frozenset(("a", "e", "i", "o", "u", "ö"))
# Vowels after which ь becomes a written y; iotated vowels (ё ю я е) already supply it.
_SOFT_SIGN_GLIDE_VOWELS = frozenset(("а", "о", "у", "э", "ў"))
_IOTATED = {"ё": "yo", "ю": "yu", "я": "ya"}
_IOTATED_REVERSE = {"yo": "ё", "yu": "ю", "ya": "я"}


def _warning(
    index: int, rule: str, message: str, alternatives: Sequence[str], length: int = 1
) -> Warning:
    return Warning(index, length, rule, message, tuple(alternatives))


def _to_source_offsets(warnings: List[Warning], origins: List[int], offset: int) -> List[Warning]:
    """Rewrite warning ranges from prepared-text offsets to offsets in the caller's text."""
    mapped: List[Warning] = []
    for item in warnings:
        index, length = source_range(origins, item.index, item.length)
        mapped.append(Warning(offset + index, length, item.rule, item.message, item.alternatives))
    return mapped


def _letter_at(source: str, index: int) -> str:
    """The lowercased letter at ``index`` for positional rules, or '' when it is not a letter."""
    if index < 0 or index >= len(source):
        return ""
    character = source[index]
    return lower_char(character) if unicodedata.category(character)[0] == "L" else ""


_LATIN_START = re.compile("[A-Za-z\u00c0-\u024f\u1e00-\u1eff]")


def _is_latin_letter(character: str) -> bool:
    """True for a BMP letter whose NFKC form starts in Latin-1, Extended-A/B or Additional.

    Astral letters (e.g. U+1D400) are skipped: the TypeScript loop walks UTF-16
    code units, so a surrogate half never matches ``\\p{L}``.
    """
    if unicodedata.category(character)[0] != "L" or ord(character) > 0xFFFF:
        return False
    return _LATIN_START.match(unicodedata.normalize("NFKC", character)) is not None


def _case_replacement(source: str, index: int, lower: str) -> str:
    """Case a multi-letter replacement: all caps inside an uppercase word, else title case."""
    character = source[index]
    if not is_upper(character):
        return lower
    in_uppercase_word = (index + 1 < len(source) and is_upper(source[index + 1])) or (
        index > 0 and is_upper(source[index - 1])
    )
    return upper_text(lower) if in_uppercase_word else first_case(character, lower)


def _from_cyrillic_core(text: str, offset: int, options: Options) -> Tuple[str, List[Warning]]:
    source, origins = apply_exceptions(prepare_text_mapped(text, options.utf16_offsets), options)
    output: List[str] = []
    warnings: List[Warning] = []
    previous_letter = ""
    position = 0

    for index, character in enumerate(source):
        lower = lower_char(character)
        replacement: Optional[str]

        if lower == "е":
            use_ye = (
                previous_letter == ""
                or previous_letter in _CYRILLIC_VOWELS
                or previous_letter == "ъ"
                or previous_letter == "ь"
            )
            replacement = "ye" if use_ye else "e"
            warnings.append(
                _warning(
                    position,
                    "cyrillic.e.positional",
                    "Cyrillic е can represent e or ye; a positional rule was applied.",
                    ("e", "ye"),
                )
            )
        elif lower == "ц":
            use_s = previous_letter == "" or previous_letter == "ц"
            replacement = "s" if use_s else "ts"
            warnings.append(
                _warning(
                    position,
                    "cyrillic.tse.positional",
                    "Cyrillic ц can represent s or ts; a positional rule was applied.",
                    ("s", "ts"),
                )
            )
        elif lower == "щ":
            replacement = "şç"
            warnings.append(
                _warning(
                    position,
                    "cyrillic.shcha.ambiguous",
                    "Cyrillic щ has no single new-Latin equivalent; şç was chosen.",
                    ("şç", "ş"),
                )
            )
        elif lower == "ъ":
            replacement = "ʼ"
            warnings.append(
                _warning(
                    position,
                    "cyrillic.hard-sign.ambiguous",
                    "The hard sign was retained as tutuq belgisi.",
                    ("ʼ", ""),
                )
            )
        elif lower == "ь":
            # Before a plain vowel the soft sign marks a glide (батальон -> batalyon); elsewhere
            # it has no Latin counterpart and is dropped (сентябрь -> medal).
            glide = _letter_at(source, index + 1) in _SOFT_SIGN_GLIDE_VOWELS
            replacement = "y" if glide else ""
            warnings.append(
                _warning(
                    position,
                    "cyrillic.soft-sign.ambiguous",
                    "The soft sign before a vowel was written as y."
                    if glide
                    else "The soft sign was dropped.",
                    ("y", "") if glide else ("", "ʼ"),
                )
            )
        elif lower in _IOTATED:
            name = _IOTATED[lower]
            replacement = name
            warnings.append(
                _warning(
                    position,
                    f"cyrillic.{name}.compound",
                    f"Cyrillic {lower} was expanded to {name}.",
                    (name, name[1:]),
                )
            )
        else:
            replacement = _DIRECT_FROM_CYRILLIC.get(lower)

        output.append(
            character if replacement is None else _case_replacement(source, index, replacement)
        )
        previous_letter = _letter_at(source, index)
        position += unit_length(character, options.utf16_offsets)

    warnings = _to_source_offsets(warnings, origins, offset)
    return nfc(old_latin_core("".join(output), options)), warnings


def _from_cyrillic(text: str, options: Options) -> ConversionResult:
    converted, warnings = map_segments(
        text, options, lambda segment, start: _from_cyrillic_core(segment, start, options)
    )
    return ConversionResult(converted, tuple(warnings))


def _to_cyrillic_core(text: str, offset: int, options: Options) -> Tuple[str, List[Warning]]:
    source, origins = prepare_text_mapped(text, options.utf16_offsets)
    length = len(source)
    output: List[str] = []
    warnings: List[Warning] = []
    index = 0
    position = 0
    while index < length:
        character = source[index]
        lower = lower_char(character)
        uppercase = character != lower
        pair = lower + (lower_char(source[index + 1]) if index + 1 < length else "")
        # Inverse of the fromCyrillic е rule: Cyrillic е is read "ye" at a word start, after
        # a vowel, or after ъ/ь, so there "ye" maps back to е and a bare "e" must be э.
        previous = _letter_at(source, index - 1) if index > 0 else ""
        positional = previous == "" or previous == "ʼ" or previous in _LATIN_VOWELS
        replacement: Optional[str]
        consumed = 1

        if pair == "şç":
            replacement = "щ"
            consumed = 2
            warnings.append(
                _warning(
                    position,
                    "latin.shcha.ambiguous",
                    "şç was interpreted as Cyrillic щ rather than шч.",
                    ("щ", "шч"),
                    2,
                )
            )
        elif pair in _IOTATED_REVERSE:
            replacement = _IOTATED_REVERSE[pair]
            consumed = 2
            warnings.append(
                _warning(
                    position,
                    f"latin.{pair}.ambiguous",
                    f"{pair} was interpreted as one iotated Cyrillic letter.",
                    (replacement, "й" + _DIRECT_TO_CYRILLIC[pair[1]]),
                    2,
                )
            )
        elif pair == "ts":
            replacement = "ц"
            consumed = 2
            warnings.append(
                _warning(
                    position,
                    "latin.tse.ambiguous",
                    "ts was interpreted as Cyrillic ц.",
                    ("ц", "тс"),
                    2,
                )
            )
        elif pair == "ye" and positional:
            replacement = "е"
            consumed = 2
            warnings.append(
                _warning(
                    position,
                    "latin.ye.positional",
                    "ye at a word start, after a vowel, or after tutuq was interpreted as "
                    "Cyrillic е.",
                    ("е", "йе"),
                    2,
                )
            )
        elif lower == "e":
            replacement = "э" if positional else "е"
            warnings.append(
                _warning(
                    position,
                    "latin.e.ambiguous",
                    f"Latin e can correspond to Cyrillic е or э; {replacement} was chosen.",
                    ("э", "е") if positional else ("е", "э"),
                )
            )
        elif character == "ʼ":
            replacement = "ъ"
            warnings.append(
                _warning(
                    position,
                    "latin.tutuq.ambiguous",
                    "Tutuq belgisi was interpreted as a hard sign.",
                    ("ъ", "ь", ""),
                )
            )
        elif lower == "c":
            replacement = "ц"
            warnings.append(
                _warning(
                    position,
                    "latin.c.ambiguous",
                    "Standalone c was interpreted as Cyrillic ц.",
                    ("ц", "с"),
                )
            )
        else:
            replacement = _DIRECT_TO_CYRILLIC.get(lower)
            if replacement is None and (_is_latin_letter(character) or character == "ʻ"):
                warnings.append(
                    _warning(
                        position,
                        "latin.unmapped",
                        (
                            "Stray ʻ is not part of oʻ or gʻ and has no Cyrillic mapping."
                            if character == "ʻ"
                            else f"Latin {character} has no Cyrillic mapping."
                        ),
                        (),
                    )
                )

        if replacement is None:
            output.append(character)
        elif uppercase:
            output.append(first_case(character, replacement))
        else:
            output.append(replacement)
        # A two-character match only ever consumes Basic Multilingual Plane letters.
        position += consumed if consumed == 2 else unit_length(character, options.utf16_offsets)
        index += consumed
    return nfc("".join(output)), _to_source_offsets(warnings, origins, offset)


def _to_cyrillic(text: str, options: Options) -> ConversionResult:
    canonical = to_new_latin_mapped(text, options)
    converted, warnings = map_segments(
        canonical.text,
        options,
        lambda segment, start: _to_cyrillic_core(segment, start, options),
    )
    # Warnings point into the new-Latin intermediate; report them against the caller's text.
    return ConversionResult(converted, tuple(_to_source_offsets(warnings, canonical.origins, 0)))


def from_cyrillic(
    text: str,
    *,
    protect_spans: bool = True,
    protected_terms: Optional[Iterable[str]] = None,
    exceptions: Optional[Mapping[str, str]] = None,
    ng_as_digraph: bool = True,
) -> ConversionResult:
    """Convert Uzbek Cyrillic to new Latin and report every lossy or ambiguous choice."""
    return _from_cyrillic(
        text,
        make_options(
            protect_spans=protect_spans,
            protected_terms=protected_terms,
            exceptions=exceptions,
            ng_as_digraph=ng_as_digraph,
        ),
    )


def to_cyrillic(
    text: str,
    *,
    protect_spans: bool = True,
    protected_terms: Optional[Iterable[str]] = None,
    exceptions: Optional[Mapping[str, str]] = None,
    ng_as_digraph: bool = True,
) -> ConversionResult:
    """Convert new Uzbek Latin to Cyrillic and report every lossy or ambiguous choice."""
    return _to_cyrillic(
        text,
        make_options(
            protect_spans=protect_spans,
            protected_terms=protected_terms,
            exceptions=exceptions,
            ng_as_digraph=ng_as_digraph,
        ),
    )
