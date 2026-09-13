"""Explicit, locale-independent case tables (mirrors ``src/case.ts``).

Python's built-in string case methods are never used on user text: the tables
below are the only case mapping this package performs.
"""

from __future__ import annotations

_CASE_PAIRS = (
    ("a", "A"),
    ("b", "B"),
    ("c", "C"),
    ("d", "D"),
    ("e", "E"),
    ("f", "F"),
    ("g", "G"),
    ("h", "H"),
    ("i", "I"),
    ("j", "J"),
    ("k", "K"),
    ("l", "L"),
    ("m", "M"),
    ("n", "N"),
    ("o", "O"),
    ("p", "P"),
    ("q", "Q"),
    ("r", "R"),
    ("s", "S"),
    ("t", "T"),
    ("u", "U"),
    ("v", "V"),
    ("w", "W"),
    ("x", "X"),
    ("y", "Y"),
    ("z", "Z"),
    ("ö", "Ö"),
    ("ğ", "Ğ"),
    ("ş", "Ş"),
    ("ç", "Ç"),
    ("ș", "Ș"),
    ("а", "А"),
    ("б", "Б"),
    ("в", "В"),
    ("г", "Г"),
    ("д", "Д"),
    ("е", "Е"),
    ("ё", "Ё"),
    ("ж", "Ж"),
    ("з", "З"),
    ("и", "И"),
    ("й", "Й"),
    ("к", "К"),
    ("л", "Л"),
    ("м", "М"),
    ("н", "Н"),
    ("о", "О"),
    ("п", "П"),
    ("р", "Р"),
    ("с", "С"),
    ("т", "Т"),
    ("у", "У"),
    ("ф", "Ф"),
    ("х", "Х"),
    ("ц", "Ц"),
    ("ч", "Ч"),
    ("ш", "Ш"),
    ("щ", "Щ"),
    ("ъ", "Ъ"),
    ("ы", "Ы"),
    ("ь", "Ь"),
    ("э", "Э"),
    ("ю", "Ю"),
    ("я", "Я"),
    ("ў", "Ў"),
    ("қ", "Қ"),
    ("ғ", "Ғ"),
    ("ҳ", "Ҳ"),
)

_LOWER_TO_UPPER = dict(_CASE_PAIRS)
_UPPER_TO_LOWER = {upper: lower for lower, upper in _CASE_PAIRS}


def lower_char(character: str) -> str:
    return _UPPER_TO_LOWER.get(character, character)


def upper_char(character: str) -> str:
    return _LOWER_TO_UPPER.get(character, character)


def lower_text(text: str) -> str:
    return "".join(_UPPER_TO_LOWER.get(character, character) for character in text)


def upper_text(text: str) -> str:
    return "".join(_LOWER_TO_UPPER.get(character, character) for character in text)


def is_upper(character: str) -> bool:
    return character in _UPPER_TO_LOWER


def first_case(source: str, lower_output: str) -> str:
    if not is_upper(source) or len(lower_output) == 0:
        return lower_output
    return upper_char(lower_output[0]) + lower_output[1:]
