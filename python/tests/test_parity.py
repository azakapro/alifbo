"""Exact behavioral parity with the TypeScript build (see scripts/gen-python-parity.mjs)."""

from __future__ import annotations

import json
from collections import Counter
from pathlib import Path
from typing import Any, Callable, Dict, List

import pytest

import alifbo
from alifbo.cyrillic import _from_cyrillic, _to_cyrillic
from alifbo.latin import _to_new_latin, _to_old_latin
from alifbo.pipeline import make_options, utf16_length

FIXTURE = Path(__file__).with_name("parity.json")
CASES: List[Dict[str, Any]] = json.loads(FIXTURE.read_text(encoding="utf-8"))["cases"]

CONVERSIONS: Dict[str, Callable[..., alifbo.ConversionResult]] = {
    "toNewLatin": alifbo.to_new_latin,
    "toOldLatin": alifbo.to_old_latin,
    "fromCyrillic": alifbo.from_cyrillic,
    "toCyrillic": alifbo.to_cyrillic,
}
INTERNAL_UTF16 = {
    "toNewLatin": _to_new_latin,
    "toOldLatin": _to_old_latin,
    "fromCyrillic": _from_cyrillic,
    "toCyrillic": _to_cyrillic,
}
PLAIN = {
    "foldSearchKey": alifbo.fold_search_key,
    "foldSearchKeyLoose": alifbo.fold_search_key_loose,
    "normalizeApostrophes": alifbo.normalize_apostrophes,
    "normalizeConfusables": alifbo.normalize_confusables,
}
OPTION_NAMES = {
    "protectSpans": "protect_spans",
    "protectedTerms": "protected_terms",
    "exceptions": "exceptions",
    "ngAsDigraph": "ng_as_digraph",
    "foreignWords": "foreign_words",
}


def python_options(case: Dict[str, Any]) -> Dict[str, Any]:
    options = {OPTION_NAMES[name]: value for name, value in case.get("options", {}).items()}
    # TypeScript shares one options object; only to_cyrillic takes foreign_words in Python.
    if case["fn"] != "toCyrillic":
        options.pop("foreign_words", None)
    return options


def warning_dicts(result: alifbo.ConversionResult) -> List[Dict[str, Any]]:
    return [
        {
            "index": warning.index,
            "length": warning.length,
            "rule": warning.rule,
            "message": warning.message,
            **(
                {} if warning.alternatives is None else {"alternatives": list(warning.alternatives)}
            ),
        }
        for warning in result.warnings
    ]


def utf16_to_code_points(text: str, offset: int) -> int:
    """Map a UTF-16 code-unit offset into ``text`` to a Python string index."""
    units = 0
    for index, character in enumerate(text):
        if units >= offset:
            return index
        units += utf16_length(character)
    return len(text) + (offset - units)


def case_id(case: Dict[str, Any]) -> str:
    return f"{case['fn']}:{case['input']!r}:{sorted(case.get('options', {}))}"


def test_fixture_covers_every_public_function() -> None:
    counts = Counter(case["fn"] for case in CASES)
    assert set(counts) == {*CONVERSIONS, *PLAIN, "detectAlphabet"}
    assert len(CASES) > 10_000


@pytest.mark.parametrize("case", CASES, ids=case_id)
def test_parity(case: Dict[str, Any]) -> None:
    fn, text, expected = case["fn"], case["input"], case["output"]

    if fn in PLAIN:
        assert PLAIN[fn](text) == expected
        return
    if fn == "detectAlphabet":
        detection = alifbo.detect_alphabet(text)
        assert {"alphabet": detection.alphabet, "confidence": detection.confidence} == expected
        return

    options = python_options(case)

    # The UTF-16 code path reproduces TypeScript offsets exactly.
    internal = INTERNAL_UTF16[fn](text, make_options(**options, utf16_offsets=True))
    assert internal.text == expected["text"]
    assert warning_dicts(internal) == expected["warnings"]

    # The public API returns identical results with Python (code point) offsets.
    public = CONVERSIONS[fn](text, **options)
    assert public.text == expected["text"]
    assert len(public.warnings) == len(internal.warnings)
    for got, reference in zip(public.warnings, internal.warnings):
        assert (got.rule, got.message, got.alternatives) == (
            reference.rule,
            reference.message,
            reference.alternatives,
        )

    # Offsets point into the caller's text in both modes, so UTF-16 ranges map exactly
    # onto Python string ranges (identically for text inside the Basic Multilingual Plane).
    assert [(warning.index, warning.index + warning.length) for warning in public.warnings] == [
        (
            utf16_to_code_points(text, warning.index),
            utf16_to_code_points(text, warning.index + warning.length),
        )
        for warning in internal.warnings
    ]
