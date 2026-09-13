"""Old Latin <-> new Latin conversion (mirrors ``src/latin.ts``)."""

from __future__ import annotations

from typing import Iterable, List, Mapping, Optional, Tuple

from .case import first_case, is_upper, lower_char, upper_text
from .normalize import MappedText, nfc, prepare_text_mapped, text_units, unit_length
from .pipeline import (
    DEFAULT_OPTIONS,
    Options,
    apply_exceptions,
    make_options,
    map_segments,
    map_segments_mapped,
)
from .types import ConversionResult, Warning

# TODO(ng): Change only this value if the authoritative law assigns a new single letter.
NG_DIGRAPH_OUTPUT = "ng"


def _is_pair_at(text: str, index: int, first: str, second: str) -> bool:
    return (
        index + 1 < len(text)
        and lower_char(text[index]) == first
        and lower_char(text[index + 1]) == second
    )


def old_latin_core_mapped(
    text: str, options: Options = DEFAULT_OPTIONS, offset: int = 0
) -> MappedText:
    """Previous Latin to new Latin, recording the source offset of every output unit."""
    utf16 = options.utf16_offsets
    source, origins = apply_exceptions(prepare_text_mapped(text, utf16), options)
    length = len(source)
    # Offset-unit position of every source character, plus the end.
    positions: List[int] = []
    units = 0
    for character in source:
        positions.append(units)
        units += unit_length(character, utf16)
    positions.append(units)
    output: List[str] = []
    output_origins: List[int] = []

    def emit(piece: str, source_index: int) -> None:
        output.append(piece)
        output_origins.extend(
            [offset + origins[positions[source_index]]] * text_units(piece, utf16)
        )

    index = 0
    while index < length:
        character = source[index]
        lower = lower_char(character)
        next_character = source[index + 1] if index + 1 < length else None

        if (lower == "o" or lower == "g") and next_character == "ʻ":
            emit(first_case(character, "ö" if lower == "o" else "ğ"), index)
            index += 2
            continue
        if (
            lower == "s"
            and next_character == "ʼ"
            and index + 2 < length
            and lower_char(source[index + 2]) == "h"
        ):
            emit(character, index)
            emit(source[index + 1], index + 1)
            emit(source[index + 2], index + 2)
            index += 3
            continue
        if _is_pair_at(source, index, "s", "h"):
            emit(first_case(character, "ş"), index)
            index += 2
            continue
        if _is_pair_at(source, index, "c", "h"):
            emit(first_case(character, "ç"), index)
            index += 2
            continue
        if options.ng_as_digraph and _is_pair_at(source, index, "n", "g"):
            if NG_DIGRAPH_OUTPUT == "ng":
                emit(source[index], index)
                emit(source[index + 1], index + 1)
            else:
                emit(first_case(character, NG_DIGRAPH_OUTPUT), index)
            index += 2
            continue
        emit(character, index)
        index += 1
    output_origins.append(offset + origins[positions[length]])

    joined = "".join(output)
    normalized = nfc(joined)
    normalized_units = text_units(normalized, utf16)
    if normalized_units != text_units(joined, utf16):
        end = output_origins[-1]
        return MappedText(
            normalized,
            [
                min(output_origins[unit] if unit < len(output_origins) else end, end)
                for unit in range(normalized_units + 1)
            ],
        )
    return MappedText(normalized, output_origins)


def old_latin_core(text: str, options: Options = DEFAULT_OPTIONS) -> str:
    return old_latin_core_mapped(text, options).text


_NEW_TO_OLD = {"ö": "oʻ", "ğ": "gʻ", "ş": "sh", "ç": "ch"}


def _new_latin_core(text: str, options: Options) -> str:
    source = apply_exceptions(prepare_text_mapped(text, options.utf16_offsets), options).text
    length = len(source)
    output: List[str] = []
    for index, character in enumerate(source):
        replacement = _NEW_TO_OLD.get(lower_char(character))
        if replacement is None:
            output.append(character)
        elif is_upper(character) and (
            (index + 1 < length and is_upper(source[index + 1]))
            or (index > 0 and is_upper(source[index - 1]))
        ):
            output.append(upper_text(replacement))
        else:
            output.append(first_case(character, replacement))
    return nfc("".join(output))


def to_new_latin_mapped(text: str, options: Options) -> MappedText:
    """Previous Latin to new Latin across protected spans, with offsets into ``text``."""
    return map_segments_mapped(
        text, options, lambda segment, start: old_latin_core_mapped(segment, options, start)
    )


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
