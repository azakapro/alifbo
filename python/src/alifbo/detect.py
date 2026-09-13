"""Best-effort alphabet detection (mirrors ``src/detect.ts``)."""

from __future__ import annotations

import re

from .normalize import normalize_confusables
from .types import AlphabetDetection

_CYRILLIC = re.compile("[А-Яа-яЁёЎўҚқҒғҲҳ]")
_LATIN = re.compile("[A-Za-zÖöĞğŞşÇç]")
_NEW_MARKERS = re.compile("[ÖöĞğŞşÇç]")
_OLD_MARKERS = re.compile("(?:[OoGg][ʻʼ'‘’`´′＇]|[Ss][Hh]|[Cc][Hh])")


def detect_alphabet(text: str) -> AlphabetDetection:
    """Return a best-effort alphabet classification and confidence between zero and one."""
    source = normalize_confusables(text)
    cyrillic = len(_CYRILLIC.findall(source))
    latin = len(_LATIN.findall(source))
    new_markers = len(_NEW_MARKERS.findall(source))
    old_markers = len(_OLD_MARKERS.findall(source))

    if cyrillic == 0 and latin == 0:
        return AlphabetDetection("unknown", 0.0)
    if cyrillic > 0 and latin > 0:
        return AlphabetDetection("mixed", 1.0)
    if cyrillic > 0:
        uzbek_specific = len(re.findall("[ЎўҚқҒғҲҳ]", source))
        length_factor = min(1.0, cyrillic / 8)
        specific_factor = uzbek_specific / cyrillic
        return AlphabetDetection(
            "cyrillic",
            min(1.0, 0.55 + 0.35 * length_factor + 0.1 * specific_factor),
        )
    if new_markers > 0 and old_markers > 0:
        return AlphabetDetection("mixed", 0.9)
    if new_markers > 0:
        return AlphabetDetection("new-latin", min(1.0, 0.7 + new_markers / latin))
    if old_markers > 0:
        return AlphabetDetection("old-latin", min(1.0, 0.7 + old_markers / latin))
    return AlphabetDetection("old-latin", 0.55)
