"""Guards against drift between the Python package and the TypeScript source of truth."""

from __future__ import annotations

import re
from pathlib import Path

import pytest

import alifbo
from alifbo import case

PYTHON_ROOT = Path(__file__).resolve().parents[1]
REPO_ROOT = PYTHON_ROOT.parent
PACKAGE = PYTHON_ROOT / "src" / "alifbo"


@pytest.mark.parametrize("name", ["exceptions.json", "protected-terms.json"])
def test_seed_data_is_byte_identical_to_typescript(name: str) -> None:
    assert (PACKAGE / "data" / name).read_bytes() == (
        REPO_ROOT / "src" / "data" / name
    ).read_bytes()


def test_license_is_byte_identical() -> None:
    assert (PYTHON_ROOT / "LICENSE").read_bytes() == (REPO_ROOT / "LICENSE").read_bytes()


def test_version_matches_npm_package() -> None:
    package_json = (REPO_ROOT / "package.json").read_text(encoding="utf-8")
    npm_version = re.search(r'"version":\s*"([^"]+)"', package_json)
    pyproject = (PYTHON_ROOT / "pyproject.toml").read_text(encoding="utf-8")
    assert npm_version is not None
    assert alifbo.__version__ == npm_version.group(1)
    assert f'version = "{npm_version.group(1)}"' in pyproject


def test_case_table_matches_typescript() -> None:
    source = (REPO_ROOT / "src" / "case.ts").read_text(encoding="utf-8")
    pairs = tuple(re.findall(r"\['(.)', '(.)'\]", source))
    assert len(pairs) > 60
    assert pairs == case._CASE_PAIRS


def test_no_implicit_unicode_case_mapping() -> None:
    pattern = re.compile(r"\.(?:upper|lower|casefold|capitalize|title|swapcase)\s*\(")
    violations = [
        path.name
        for path in PACKAGE.glob("*.py")
        if pattern.search(path.read_text(encoding="utf-8"))
    ]
    assert violations == []


def test_public_api() -> None:
    assert set(alifbo.__all__) >= {
        "to_new_latin",
        "to_old_latin",
        "from_cyrillic",
        "to_cyrillic",
        "fold_search_key",
        "fold_search_key_loose",
        "normalize_apostrophes",
        "normalize_confusables",
        "detect_alphabet",
        "ConversionResult",
        "Warning",
    }
    assert (PACKAGE / "py.typed").exists()
