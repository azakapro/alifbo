"""Ports of the TypeScript unit tests plus Python-specific API behavior."""

from __future__ import annotations

import dataclasses
import re
import unicodedata

import pytest

from alifbo import (
    ConversionResult,
    Warning,
    detect_alphabet,
    fold_search_key,
    fold_search_key_loose,
    from_cyrillic,
    normalize_apostrophes,
    normalize_confusables,
    to_cyrillic,
    to_new_latin,
    to_old_latin,
)

DIRECT_MAPPINGS = [
    ("а", "А", "a", "A"),
    ("б", "Б", "b", "B"),
    ("в", "В", "v", "V"),
    ("г", "Г", "g", "G"),
    ("д", "Д", "d", "D"),
    ("ж", "Ж", "j", "J"),
    ("з", "З", "z", "Z"),
    ("и", "И", "i", "I"),
    ("й", "Й", "y", "Y"),
    ("к", "К", "k", "K"),
    ("л", "Л", "l", "L"),
    ("м", "М", "m", "M"),
    ("н", "Н", "n", "N"),
    ("о", "О", "o", "O"),
    ("п", "П", "p", "P"),
    ("р", "Р", "r", "R"),
    ("с", "С", "s", "S"),
    ("т", "Т", "t", "T"),
    ("у", "У", "u", "U"),
    ("ф", "Ф", "f", "F"),
    ("х", "Х", "x", "X"),
    ("ч", "Ч", "ç", "Ç"),
    ("ш", "Ш", "ş", "Ş"),
    ("ы", "Ы", "i", "I"),
    ("э", "Э", "e", "E"),
    ("ў", "Ў", "ö", "Ö"),
    ("қ", "Қ", "q", "Q"),
    ("ғ", "Ғ", "ğ", "Ğ"),
    ("ҳ", "Ҳ", "h", "H"),
]


@pytest.mark.parametrize(("lower", "upper", "latin_lower", "latin_upper"), DIRECT_MAPPINGS)
def test_direct_cyrillic_mappings(lower: str, upper: str, latin_lower: str, latin_upper: str):
    assert from_cyrillic(lower) == ConversionResult(latin_lower, ())
    assert from_cyrillic(upper) == ConversionResult(latin_upper, ())
    if lower not in ("ы", "э"):
        assert to_cyrillic(latin_lower).text == lower
        assert to_cyrillic(latin_upper).text == upper


def test_lone_latin_e_starts_a_word_and_maps_to_cyrillic_e_oborotnoye():
    # A lone e starts a word, where Cyrillic uses э; after a consonant it is е.
    assert to_cyrillic("e").text == "э"
    assert to_cyrillic("E").text == "Э"
    assert to_cyrillic("ke").text == "ке"


def test_warns_at_each_ambiguous_source_construct():
    result = from_cyrillic("е ц щ ъ ь ё ю я")
    assert [warning.rule for warning in result.warnings] == [
        "cyrillic.e.positional",
        "cyrillic.tse.positional",
        "cyrillic.shcha.ambiguous",
        "cyrillic.hard-sign.ambiguous",
        "cyrillic.soft-sign.ambiguous",
        "cyrillic.yo.compound",
        "cyrillic.yu.compound",
        "cyrillic.ya.compound",
    ]
    assert all(len(warning.alternatives or ()) > 1 for warning in result.warnings)


def test_reverse_warnings_with_source_indexes():
    result = to_cyrillic("e şç yo yu ya ʼ")
    assert result.text == "э щ ё ю я ъ"
    assert len(result.warnings) >= 6
    assert (result.warnings[0].index, result.warnings[0].length) == (0, 1)


def test_warning_offsets_are_anchored_around_protected_spans():
    prefix = "https://example.uz/е "
    result = from_cyrillic(f"{prefix}Елена")
    assert result.text == f"{prefix}Yelena"
    assert [warning.index for warning in result.warnings] == [len(prefix), len(prefix) + 2]


def test_warning_offsets_are_python_string_indexes():
    text = "😀 Елена"
    result = from_cyrillic(text)
    assert [warning.index for warning in result.warnings] == [2, 4]
    assert text[result.warnings[0].index] == "Е"
    assert text[result.warnings[1].index] == "е"


def test_protected_spans_in_either_direction():
    assert from_cyrillic("`Шавкат` Шавкат").text == "`Шавкат` Şavkat"
    assert to_cyrillic("https://example.uz/sh Şavkat").text == "https://example.uz/sh Шавкат"


def test_fullwidth_and_ordinal_latin_warn_unmapped():
    def rules(text: str):
        return [w.rule for w in to_cyrillic(text, foreign_words="transliterate").warnings]

    assert "latin.unmapped" in rules("Ａ")
    assert "latin.unmapped" in rules("ª")
    # By default such letters make the whole word foreign instead.
    assert [w.rule for w in to_cyrillic("Ａ").warnings] == ["latin.foreign"]


def test_ipa_turned_a_does_not_warn_unmapped():
    warnings = to_cyrillic("ɐ", foreign_words="transliterate").warnings
    assert all(warning.rule != "latin.unmapped" for warning in warnings)


MIXED_SENTENCES = [
    "Toshkent hokimligi Microsoft Windows va Wi-Fi tizimiga oʻtdi. Zürich shahri, tongʻ.",
    "Yigʻilish Zoom va Google Meet orqali, hujjatlar Microsoft Word formatida.",
    "iPhone 15, Samsung Galaxy S24 va Xiaomi telefonlari sotuvda.",
    "Hisobot COVID-19 pandemiyasi davrida SiO2 va H2O tahlili haqida.",
    "Coca-Cola, McDonald's va Wendy's Toshkentda ochildi.",
    "YouTube, ChatGPT, LinkedIn va WhatsApp ilovalari.",
    "Oʻzbekiston Respublikasi Konstitutsiyasi 2026-yil 15-sentyabr.",
]


def test_foreign_word_is_kept_and_reported_once():
    text = "Toshkent Windows shahri"
    result = to_cyrillic(text)
    assert result.text == "Тошкент Windows шаҳри"
    foreign = [w for w in result.warnings if w.rule == "latin.foreign"]
    assert len(foreign) == 1
    assert text[foreign[0].index : foreign[0].index + foreign[0].length] == "Windows"
    assert foreign[0].alternatives == ("Windows", "Wиндоwс")
    assert all(w.rule != "latin.unmapped" for w in result.warnings)


def test_foreign_signals_bare_c_mixed_case_diacritics_but_not_ch():
    assert to_cyrillic("Microsoft").text == "Microsoft"
    assert to_cyrillic("iPhone SiO2 ChatGPT").text == "iPhone SiO2 ChatGPT"
    assert to_cyrillic("Zürich").text == "Zürich"
    assert to_cyrillic("Chelsea chempion").text == "Chelsea чемпион"
    assert to_cyrillic("Michael").text == "Мичаэл"


def test_foreign_word_keeps_suffixes_and_hyphenated_parts():
    assert to_cyrillic("Windowsda Wi-Fi-ga Coca-Cola").text == "Windowsda Wi-Fi-ga Coca-Cola"
    assert to_cyrillic("Toshkent-Samarqand 2026-yil").text == "Тошкент-Самарқанд 2026-йил"
    assert to_cyrillic("McDonald's").text == "McDonald's"


def test_pure_uzbek_text_is_unaffected_by_foreign_word_handling():
    text = "Bu matnda hech qanday xorijiy harf yoʻq. Oʻzbekiston oʻzbek, Isʼhoq."
    assert to_cyrillic(text) == to_cyrillic(text, foreign_words="transliterate")
    assert all(w.rule != "latin.foreign" for w in to_cyrillic(text).warnings)


def test_transliterate_option_restores_letter_by_letter_output():
    result = to_cyrillic("Windows", foreign_words="transliterate")
    assert result.text == "Wиндоwс"
    assert [w.rule for w in result.warnings] == ["latin.unmapped", "latin.unmapped"]
    with pytest.raises(ValueError):
        to_cyrillic("Windows", foreign_words="drop")


def test_foreign_offsets_point_into_the_callers_text():
    text = "shahar https://x.uz/Windows Windows choʻl Zürich"
    result = to_cyrillic(text)
    assert result.text == "шаҳар https://x.uz/Windows Windows чўл Zürich"
    hits = [
        text[w.index : w.index + w.length] for w in result.warnings if w.rule == "latin.foreign"
    ]
    assert hits == ["Windows", "Zürich"]


@pytest.mark.parametrize("sentence", MIXED_SENTENCES)
def test_output_never_has_latin_after_cyrillic_inside_a_word(sentence):
    text = to_cyrillic(sentence).text
    for word in re.split(r"[^\w'ʻʼ-]+", text):
        assert not re.search(r"[\u0400-\u04ff][^\s]*[A-Za-z]", word), (word, text)


@pytest.mark.parametrize(
    ("text", "alphabet"),
    [
        ("Шавкат", "cyrillic"),
        ("Oʻzbekiston shahar", "old-latin"),
        ("Özbekiston şahar", "new-latin"),
        ("Шавкат Şavkat", "mixed"),
        ("123 !?", "unknown"),
    ],
)
def test_detect_alphabet(text: str, alphabet: str):
    result = detect_alphabet(text)
    assert result.alphabet == alphabet
    assert 0 <= result.confidence <= 1


def test_detect_alphabet_cyrillic_confidence_scales_with_evidence():
    one = detect_alphabet("Ў")
    sentence = detect_alphabet("Ўзбекистонда қишлоқ хўжалиги ривожланмоқда")
    assert one.alphabet == "cyrillic"
    assert sentence.alphabet == "cyrillic"
    assert 0 < one.confidence < 1
    assert one.confidence < sentence.confidence <= 1


def test_round_trips_unambiguous_old_latin():
    state = 0x5EED1234
    tokens = [
        "a",
        "b",
        "d",
        "e",
        "f",
        "g",
        "gʻ",
        "h",
        "i",
        "j",
        "k",
        "l",
        "m",
        "n",
        "ng",
        "o",
        "oʻ",
        "p",
        "q",
        "r",
        "s",
        "sh",
        "t",
        "u",
        "v",
        "x",
        "y",
        "z",
        "ch",
        "ʼ",
    ]
    for _ in range(500):
        text = ""
        for _ in range(24):
            state = (state * 1664525 + 1013904223) % 2**32
            text += tokens[state % len(tokens)]
        assert to_old_latin(to_new_latin(text).text).text == normalize_apostrophes(text)


def test_exceptions_longest_first_and_reverse():
    assert to_new_latin("shahar sh", exceptions={"sh": "X", "shahar": "Y"}).text == "Y X"
    assert to_old_latin("şahar", exceptions={"şahar": "city"}).text == "city"


def test_uppercase_expansion():
    assert to_old_latin("ŞAHAR ÇÖĞ").text == "SHAHAR CHOʻGʻ"
    assert to_old_latin("Şahar").text == "Shahar"


def test_protected_terms_and_disabling_protection():
    assert to_new_latin("MyShop shahar", protected_terms=["MyShop"]).text == "MyShop şahar"
    assert "/ş" in to_new_latin("https://x.uz/sh", protect_spans=False).text
    with pytest.raises(TypeError):
        to_new_latin("MyShop", protected_terms="MyShop")  # type: ignore[arg-type]


@pytest.mark.parametrize("apostrophe", ["ʻ", "ʼ", "'", "‘", "’", "`", "´", "′", "＇"])
def test_apostrophe_variants(apostrophe: str):
    assert to_new_latin(f"O{apostrophe}").text == "Ö"
    assert to_new_latin(f"G{apostrophe}").text == "Ğ"
    assert to_new_latin(f"A{apostrophe}A").text == "AʼA"


def test_confusables_and_apostrophe_normalization():
    assert normalize_confusables("ș Ș") == "ş Ş"
    assert "ș" not in to_new_latin("ș Ș sh").text
    assert "Ș" not in to_new_latin("ș Ș sh").text
    assert normalize_apostrophes("o' g’ a‘b c`d e´f h′i j＇k") == "oʻ gʻ aʼb cʼd eʼf hʼi jʼk"


def test_nfd_input_and_protected_nfd_terms():
    nfc = "Oʻzbekiston, şahar, gʻoya"
    nfd = unicodedata.normalize("NFD", nfc)
    assert to_new_latin(nfd).text == to_new_latin(nfc).text
    protected = "Cafe\u0301Sh"
    assert to_new_latin(f"{protected} sh", protected_terms=[protected]).text == f"{protected} ş"


def test_s_tutuq_h_and_ng():
    assert to_new_latin("asʼhob Asʼhob ASʼHOB").text == "asʼhob Asʼhob ASʼHOB"
    assert to_new_latin("tong Tong TONG", ng_as_digraph=True).text == "tong Tong TONG"
    assert to_new_latin("tong Tong TONG", ng_as_digraph=False).text == "tong Tong TONG"


@pytest.mark.parametrize(
    ("old_latin", "new_latin", "cyrillic"),
    [("Shavkat", "Şavkat", "Шавкат"), ("Oʻzbekiston", "Özbekiston", "Ўзбекистон")],
)
def test_search_keys_fold_alphabets(old_latin: str, new_latin: str, cyrillic: str):
    assert fold_search_key(old_latin) == fold_search_key(new_latin) == fold_search_key(cyrillic)


def test_search_key_diacritics_and_turkish_i():
    assert fold_search_key("ol") != fold_search_key("öl")
    assert fold_search_key_loose("ol") == fold_search_key_loose("öl")
    for text in ["i I ish ISH И ИШ"]:
        assert not set(to_new_latin(text).text) & {"İ", "ı"}
        assert not set(fold_search_key(text)) & {"İ", "ı"}


def test_results_are_frozen():
    result = from_cyrillic("Елена")
    assert isinstance(result.warnings, tuple)
    assert isinstance(result.warnings[0], Warning)
    assert result.warnings[0].alternatives == ("e", "ye")
    with pytest.raises(dataclasses.FrozenInstanceError):
        result.text = "x"  # type: ignore[misc]


def test_empty_exception_keys_are_ignored():
    assert to_new_latin(" sh ", exceptions={"": "X"}).text == " ş "
