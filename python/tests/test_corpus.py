"""Golden corpus shared with the TypeScript test suite (``../test/corpus/*.json``)."""

from __future__ import annotations

import json
from pathlib import Path
from typing import Any, Dict, List

import pytest

from alifbo import from_cyrillic, to_new_latin

CORPUS = Path(__file__).resolve().parents[2] / "test" / "corpus"


def corpus(name: str) -> List[Dict[str, Any]]:
    return json.loads((CORPUS / f"{name}.json").read_text(encoding="utf-8"))


LATIN_CASES = [case for name in ("apostrophes", "latin", "protected") for case in corpus(name)]


@pytest.mark.parametrize("case", LATIN_CASES, ids=lambda case: f"{case['rule']}: {case['note']}")
def test_latin_golden_corpus(case: Dict[str, Any]) -> None:
    assert to_new_latin(case["input"]).text == case["expected"]


@pytest.mark.parametrize(
    "case", corpus("cyrillic"), ids=lambda case: f"{case['rule']}: {case['note']}"
)
def test_cyrillic_golden_corpus(case: Dict[str, Any]) -> None:
    assert from_cyrillic(case["input"]).text == case["expected"]
