"""Port of test/regressions.test.ts."""

from __future__ import annotations

import unicodedata

import pytest

from alifbo import from_cyrillic, to_cyrillic, to_new_latin, to_old_latin
from alifbo.cyrillic import _from_cyrillic, _to_cyrillic
from alifbo.pipeline import make_options

# Inverse of the documented from_cyrillic rule: е is "ye" at a word start, after a
# vowel, or after ъ/ь, and "e" elsewhere; э is always "e".
ROUND_TRIPS = [
    ("Европа", "Yevropa"),
    ("ер", "yer"),
    ("поезд", "poyezd"),
    ("подъезд", "podʼyezd"),
    ("экран", "ekran"),
    ("Экран", "Ekran"),
    ("поэт", "poet"),
    ("театр", "teatr"),
    ("келди", "keldi"),
    ("ЕР", "YER"),
]


@pytest.mark.parametrize(("cyrillic", "latin"), ROUND_TRIPS)
def test_cyrillic_e_round_trips(cyrillic: str, latin: str) -> None:
    assert from_cyrillic(cyrillic).text == latin
    assert to_cyrillic(latin).text == cyrillic


def test_warns_about_the_positional_choices_it_makes() -> None:
    warnings = to_cyrillic("yer").warnings
    assert [(w.rule, w.index, w.length) for w in warnings] == [("latin.ye.positional", 0, 2)]
    assert warnings[0].alternatives == ("е", "йе")

    ekran = to_cyrillic("ekran").warnings[0]
    assert (ekran.rule, ekran.alternatives) == ("latin.e.ambiguous", ("э", "е"))
    assert ekran.message == "Latin e can correspond to Cyrillic е or э; э was chosen."

    keldi = to_cyrillic("keldi").warnings[0]
    assert (keldi.rule, keldi.alternatives) == ("latin.e.ambiguous", ("е", "э"))
    assert keldi.message == "Latin e can correspond to Cyrillic е or э; е was chosen."


def test_keeps_multi_letter_replacements_uppercase_at_the_end_of_a_word() -> None:
    assert to_old_latin("QUYOŞ TOŞKENT ÇÖL").text == "QUYOSH TOSHKENT CHOʻL"
    assert to_old_latin("OŞ").text == "OSH"
    assert to_old_latin("Ş Şahar").text == "Sh Shahar"


def test_keeps_cyrillic_expansions_uppercase_inside_uppercase_words() -> None:
    assert from_cyrillic("ЁЗУВ ЮРТ ЯНГИ ЩЁТКА").text == "YOZUV YURT YANGI ŞÇYOTKA"
    assert from_cyrillic("Ёзув Ё").text == "Yozuv Yo"


def test_ignores_an_empty_exception_key() -> None:
    assert to_new_latin(" sh", exceptions={"": "X"}).text == " ş"


def test_exception_word_boundaries_next_to_astral_letters() -> None:
    assert to_new_latin("𝐀shahar shahar", exceptions={"shahar": "Y"}).text == "𝐀şahar Y"


def test_offsets_account_for_old_latin_digraphs_before_converting_to_cyrillic() -> None:
    result = to_cyrillic("Shahar teatr")
    assert result.text == "Шаҳар театр"
    first = result.warnings[0]
    assert (first.rule, first.index, first.length) == ("latin.e.ambiguous", 8, 1)


def test_offsets_account_for_exceptions_that_change_length() -> None:
    result = from_cyrillic("Шавкат ер", exceptions={"Шавкат": "X"})
    assert result.text == "X yer"
    assert (result.warnings[0].rule, result.warnings[0].index) == ("cyrillic.e.positional", 7)


def test_offsets_account_for_nfc_composition_of_decomposed_input() -> None:
    decomposed = "\u0438\u0306 ер"
    assert unicodedata.normalize("NFC", decomposed) == "\u0439 ер"
    result = from_cyrillic(decomposed)
    assert result.text == "y yer"
    assert (result.warnings[0].index, result.warnings[0].length) == (3, 1)
    assert decomposed[3] == "е"


def test_offsets_span_every_source_character_of_a_replaced_digraph() -> None:
    result = to_cyrillic("Sheʼr")
    assert [(w.rule, w.index, w.length) for w in result.warnings] == [
        ("latin.e.ambiguous", 2, 1),
        ("latin.tutuq.ambiguous", 3, 1),
    ]


def test_astral_letter_counts_as_a_letter_for_positional_e() -> None:
    assert from_cyrillic("𝐀е").text == "𝐀e"
    assert from_cyrillic("😀 е").text == "😀 ye"


# Python-specific: astral characters take one code point publicly and two UTF-16 code
# units in the internal parity mode.


def test_astral_offsets_point_into_the_callers_text() -> None:
    text = "😀 Shahar teatr"
    public = to_cyrillic(text).warnings[0]
    assert (public.index, public.length) == (10, 1)
    assert text[public.index] == "e"
    internal = _to_cyrillic(text, make_options(utf16_offsets=True)).warnings[0]
    assert (internal.index, internal.length) == (11, 1)


def test_astral_exception_key_spans_one_code_point_or_two_code_units() -> None:
    text = "😀 ер"
    public = from_cyrillic(text, exceptions={"😀": "smile"}).warnings
    assert [(w.index, w.length) for w in public] == [(2, 1)]
    internal = _from_cyrillic(text, make_options(exceptions={"😀": "smile"}, utf16_offsets=True))
    assert [(w.index, w.length) for w in internal.warnings] == [(3, 1)]

    # A warning on text produced by the exception covers the whole replaced key.
    public_e = to_cyrillic("😀", exceptions={"😀": "smile"}).warnings
    assert [(w.rule, w.index, w.length) for w in public_e] == [("latin.e.ambiguous", 0, 1)]
    internal_e = _to_cyrillic("😀", make_options(exceptions={"😀": "smile"}, utf16_offsets=True))
    assert [(w.rule, w.index, w.length) for w in internal_e.warnings] == [
        ("latin.e.ambiguous", 0, 2)
    ]


@pytest.mark.parametrize(
    ("cyrillic", "latin"),
    [
        ("батальон", "batalyon"),
        ("павильон", "pavilyon"),
        ("бульон", "bulyon"),
        ("БАТАЛЬОН", "BATALYON"),
        ("медаль", "medal"),
        ("Ильич", "Iliç"),
        ("серьёзно", "seryozno"),
        ("ь", ""),
    ],
)
def test_soft_sign_before_a_vowel_becomes_y(cyrillic: str, latin: str) -> None:
    assert from_cyrillic(cyrillic).text == latin


def test_soft_sign_glide_warning() -> None:
    warning = from_cyrillic("бульон").warnings[0]
    assert warning.rule == "cyrillic.soft-sign.ambiguous"
    assert warning.alternatives == ("y", "")
