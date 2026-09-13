"""Protected spans, word exceptions, and segment mapping (mirrors ``src/pipeline.ts``).

JavaScript semantics that matter here are emulated explicitly:

* ``\\p{L}``/``\\p{N}``/``\\p{M}`` are implemented with ``unicodedata.category``.
* JavaScript ``\\s`` is spelled out as an explicit character class.
* Exception word boundaries test whole code points, so astral letters count.
* ``Object.entries`` ordering (array-index keys first) is reproduced for exceptions.
"""

from __future__ import annotations

import json
import re
import unicodedata
from dataclasses import dataclass
from importlib.resources import files
from typing import Callable, Iterable, List, Mapping, NamedTuple, Optional, Tuple

from .normalize import MappedText, text_units, unit_length, utf16_length
from .types import Warning


def _load_json(name: str) -> object:
    return json.loads(
        files(__package__).joinpath("data").joinpath(name).read_text(encoding="utf-8")
    )


_SEED_EXCEPTIONS: Tuple[Tuple[str, str], ...] = tuple(
    _load_json("exceptions.json").items()  # type: ignore[attr-defined]
)
_SEED_PROTECTED_TERMS: Tuple[str, ...] = tuple(_load_json("protected-terms.json"))  # type: ignore[arg-type]

_MAX_ARRAY_INDEX = 2**32 - 2
_ARRAY_INDEX = re.compile("0|[1-9][0-9]*")


def _is_letter(character: str) -> bool:
    return unicodedata.category(character)[0] == "L"


def _is_letter_or_number(character: str) -> bool:
    return unicodedata.category(character)[0] in "LN"


def _is_word_character(character: str) -> bool:
    """JavaScript ``/^[\\p{L}\\p{N}\\p{M}]$/u`` for one whole code point."""
    return unicodedata.category(character)[0] in "LNM"


def _is_array_index(key: str) -> bool:
    return _ARRAY_INDEX.fullmatch(key) is not None and int(key) <= _MAX_ARRAY_INDEX


@dataclass(frozen=True)
class Options:
    protect_spans: bool = True
    protected_terms: Tuple[str, ...] = ()
    exception_entries: Tuple[Tuple[str, str], ...] = ()
    ng_as_digraph: bool = True
    utf16_offsets: bool = False


def make_options(
    *,
    protect_spans: bool = True,
    protected_terms: Optional[Iterable[str]] = None,
    exceptions: Optional[Mapping[str, str]] = None,
    ng_as_digraph: bool = True,
    utf16_offsets: bool = False,
) -> Options:
    if isinstance(protected_terms, str):
        raise TypeError("protected_terms must be an iterable of strings, not a single string")
    merged = dict(_SEED_EXCEPTIONS)
    if exceptions is not None:
        merged.update(exceptions)
    items = list(merged.items())
    # Object.entries lists array-index keys first, in ascending numeric order.
    ordered = sorted(
        (item for item in items if _is_array_index(item[0])), key=lambda item: int(item[0])
    ) + [item for item in items if not _is_array_index(item[0])]
    # Empty keys would loop forever in the TypeScript implementation; they can never
    # consume text, so they are ignored here.
    entries = sorted(
        (item for item in ordered if len(item[0]) > 0),
        key=lambda item: -utf16_length(item[0]),
    )
    return Options(
        protect_spans=bool(protect_spans),
        protected_terms=tuple(protected_terms or ()),
        exception_entries=tuple(entries),
        ng_as_digraph=bool(ng_as_digraph),
        utf16_offsets=utf16_offsets,
    )


DEFAULT_OPTIONS = make_options()


class Segment(NamedTuple):
    text: str
    start: int
    protected: bool


_CODE_SPAN = re.compile("`[^`\n]*`")
# JavaScript \s: WhiteSpace and LineTerminator code points.
_JS_WHITESPACE = "\t\n\v\f\r \u00a0\u1680\u2000-\u200a\u2028\u2029\u202f\u205f\u3000\ufeff"
_URL = re.compile("(?:https?://|www\\.)[^" + _JS_WHITESPACE + "`]+")
_EMAIL_LOCAL_EXTRA = frozenset("._%+-")
_EMAIL_DOMAIN_EXTRA = frozenset(".-")


def _email_spans(text: str) -> List[Tuple[int, int]]:
    """Emulate ``text.matchAll(/[\\p{L}\\p{N}._%+-]+@[\\p{L}\\p{N}.-]+\\.[\\p{L}]{2,}/gu)``."""
    spans: List[Tuple[int, int]] = []
    length = len(text)
    last_index = 0
    at = text.find("@", last_index)
    while at >= 0:
        start = at
        while start > last_index and (
            _is_letter_or_number(text[start - 1]) or text[start - 1] in _EMAIL_LOCAL_EXTRA
        ):
            start -= 1
        if start < at:
            run_end = at + 1
            while run_end < length and (
                _is_letter_or_number(text[run_end]) or text[run_end] in _EMAIL_DOMAIN_EXTRA
            ):
                run_end += 1
            dot = run_end - 1
            while dot >= at + 2:
                if (
                    text[dot] == "."
                    and dot + 2 < length
                    and _is_letter(text[dot + 1])
                    and _is_letter(text[dot + 2])
                ):
                    break
                dot -= 1
            if dot >= at + 2:
                end = dot + 1
                while end < length and _is_letter(text[end]):
                    end += 1
                spans.append((start, end))
                last_index = end
                at = text.find("@", end)
                continue
        at = text.find("@", at + 1)
    return spans


def split_protected(text: str, options: Options = DEFAULT_OPTIONS) -> List[Segment]:
    if not options.protect_spans:
        return [Segment(text, 0, False)]

    spans: List[Tuple[int, int]] = []
    spans.extend(match.span() for match in _CODE_SPAN.finditer(text))
    spans.extend(_email_spans(text))
    spans.extend(match.span() for match in _URL.finditer(text))

    for term in (*_SEED_PROTECTED_TERMS, *options.protected_terms):
        if len(term) == 0:
            continue
        start = text.find(term)
        while start >= 0:
            spans.append((start, start + len(term)))
            start = text.find(term, start + len(term))

    spans.sort(key=lambda span: (span[0], -(span[1] - span[0])))
    selected: List[Tuple[int, int]] = []
    for span in spans:
        if not selected or span[0] >= selected[-1][1]:
            selected.append(span)

    segments: List[Segment] = []
    cursor = 0
    for start, end in selected:
        if start > cursor:
            segments.append(Segment(text[cursor:start], cursor, False))
        segments.append(Segment(text[start:end], start, True))
        cursor = end
    if cursor < len(text):
        segments.append(Segment(text[cursor:], cursor, False))
    return segments if segments else [Segment(text, 0, False)]


def apply_exceptions(source: MappedText, options: Options) -> MappedText:
    """Replace whole-word exceptions, mapping each replacement unit to the key's start."""
    text, origins = source
    utf16 = options.utf16_offsets
    entries = options.exception_entries
    length = len(text)
    result: List[str] = []
    result_origins: List[int] = []
    cursor = 0
    units = 0  # ``cursor`` in offset units
    while cursor < length:
        before_is_word = cursor > 0 and _is_word_character(text[cursor - 1])
        for key, value in entries:
            after_index = cursor + len(key)
            if (
                not before_is_word
                and text.startswith(key, cursor)
                and not (after_index < length and _is_word_character(text[after_index]))
            ):
                result.append(value)
                result_origins.extend([origins[units]] * text_units(value, utf16))
                cursor = after_index
                units += text_units(key, utf16)
                break
        else:
            character = text[cursor]
            result.append(character)
            width = unit_length(character, utf16)
            result_origins.extend(origins[units : units + width])
            cursor += 1
            units += width
    result_origins.append(origins[units])
    return MappedText("".join(result), result_origins)


Converter = Callable[[str, int], Tuple[str, List[Warning]]]


def segment_starts(text: str, options: Options) -> List[Tuple[Segment, int]]:
    """Protected-span segments with each start converted to offset units."""
    starts: List[Tuple[Segment, int]] = []
    cursor = 0
    units = 0
    for segment in split_protected(text, options):
        if options.utf16_offsets:
            units += utf16_length(text[cursor : segment.start])
            cursor = segment.start
            starts.append((segment, units))
        else:
            starts.append((segment, segment.start))
    return starts


def map_segments(text: str, options: Options, convert: Converter) -> Tuple[str, List[Warning]]:
    """Convert unprotected segments; ``convert`` receives the segment start in offset units."""
    output: List[str] = []
    warnings: List[Warning] = []
    for segment, start in segment_starts(text, options):
        if segment.protected:
            output.append(segment.text)
        else:
            converted, segment_warnings = convert(segment.text, start)
            output.append(converted)
            warnings.extend(segment_warnings)
    return "".join(output), warnings


def map_segments_mapped(
    text: str, options: Options, convert: Callable[[str, int], MappedText]
) -> MappedText:
    """Like ``map_segments``, for converters that report where each output unit came from."""
    utf16 = options.utf16_offsets
    output: List[str] = []
    origins: List[int] = []
    for segment, start in segment_starts(text, options):
        if segment.protected:
            converted = MappedText(
                segment.text,
                list(range(start, start + text_units(segment.text, utf16) + 1)),
            )
        else:
            converted = convert(segment.text, start)
        output.append(converted.text)
        origins.extend(converted.origins[: text_units(converted.text, utf16)])
    origins.append(text_units(text, utf16))
    return MappedText("".join(output), origins)
