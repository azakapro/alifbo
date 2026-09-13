"""Old Latin <-> new Latin conversion (mirrors ``src/latin.ts``)."""

from __future__ import annotations

from typing import Iterable, List, Mapping, Optional, Tuple

from .case import first_case, is_upper, lower_char, upper_text
from .normalize import nfc, prepare_text
from .pipeline import DEFAULT_OPTIONS, Options, apply_exceptions, make_options, map_segments
from .types import ConversionResult, Warning

# TODO(ng): Change only this value if the authoritative law assigns a new single letter.
NG_DIGRAPH_OUTPUT = "ng"


def _is_pair_at(text: str, index: int, first: str, second: str) -> bool:
    return (
        index + 1 < len(text)
        and lower_char(text[index]) == first
        and lower_char(text[index + 1]) == second
    )


def old_latin_core(text: str, options: Options = DEFAULT_OPTIONS) -> str:
    source = apply_exceptions(prepare_text(text), options)
    length = len(source)
    output: List[str] = []
    index = 0
    while index < length:
        character = source[index]
        lower = lower_char(character)
        next_character = source[index + 1] if index + 1 < length else None

        if (lower == "o" or lower == "g") and next_character == "ʻ":
            output.append(first_case(character, "ö" if lower == "o" else "ğ"))
            index += 2
            continue
        if (
            lower == "s"
            and next_character == "ʼ"
            and index + 2 < length
            and lower_char(source[index + 2]) == "h"
        ):
            output.append(source[index : index + 3])
            index += 3
            continue
        if _is_pair_at(source, index, "s", "h"):
            output.append(first_case(character, "ş"))
            index += 2
            continue
        if _is_pair_at(source, index, "c", "h"):
            output.append(first_case(character, "ç"))
            index += 2
            continue
        if options.ng_as_digraph and _is_pair_at(source, index, "n", "g"):
            output.append(
                source[index : index + 2]
                if NG_DIGRAPH_OUTPUT == "ng"
                else first_case(character, NG_DIGRAPH_OUTPUT)
            )
            index += 2
            continue
        output.append(character)
        index += 1
    return nfc("".join(output))


_NEW_TO_OLD = {"ö": "oʻ", "ğ": "gʻ", "ş": "sh", "ç": "ch"}


def _new_latin_core(text: str, options: Options) -> str:
    source = apply_exceptions(prepare_text(text), options)
    length = len(source)
    output: List[str] = []
    for index, character in enumerate(source):
        replacement = _NEW_TO_OLD.get(lower_char(character))
        if replacement is None:
            output.append(character)
        elif is_upper(character) and index + 1 < length and is_upper(source[index + 1]):
            output.append(upper_text(replacement))
        else:
            output.append(first_case(character, replacement))
    return nfc("".join(output))


def _to_new_latin(text: str, options: Options) -> ConversionResult:
    def convert(segment: str, _start: int) -> Tuple[str, List[Warning]]:
        return old_latin_core(segment, options), []

    converted, warnings = map_segments(text, options, convert)
    return ConversionResult(converted, tuple(warnings))


def _to_old_latin(text: str, options: Options) -> ConversionResult:
    def convert(segment: str, _start: int) -> Tuple[str, List[Warning]]:
        return _new_latin_core(segment, options), []

    converted, warnings = map_segments(text, options, convert)
    return ConversionResult(converted, tuple(warnings))


def to_new_latin(
    text: str,
    *,
    protect_spans: bool = True,
    protected_terms: Optional[Iterable[str]] = None,
    exceptions: Optional[Mapping[str, str]] = None,
    ng_as_digraph: bool = True,
) -> ConversionResult:
    """Convert previous Uzbek Latin text to the new Latin alphabet."""
    return _to_new_latin(
        text,
        make_options(
            protect_spans=protect_spans,
            protected_terms=protected_terms,
            exceptions=exceptions,
            ng_as_digraph=ng_as_digraph,
        ),
    )


def to_old_latin(
    text: str,
    *,
    protect_spans: bool = True,
    protected_terms: Optional[Iterable[str]] = None,
    exceptions: Optional[Mapping[str, str]] = None,
    ng_as_digraph: bool = True,
) -> ConversionResult:
    """Convert new Uzbek Latin text to the previous Latin alphabet."""
    return _to_old_latin(
        text,
        make_options(
            protect_spans=protect_spans,
            protected_terms=protected_terms,
            exceptions=exceptions,
            ng_as_digraph=ng_as_digraph,
        ),
    )
