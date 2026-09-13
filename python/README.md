# alifbo for Python

Python port of [`alifbo`](https://github.com/azakapro/alifbo): Uzbek transliteration between Cyrillic, the previous Latin alphabet, and the Latin alphabet approved by Uzbekistan's Senate on 10 September 2026. The amending law still awaits the president's signature and is not yet in force.

The port has zero runtime dependencies, supports Python 3.9+, ships type hints (`py.typed`), and is tested against a fixture of more than 13,000 cases generated from the TypeScript build to produce identical output.

## Install

```sh
pip install alifbo
```

## Usage

```python
from alifbo import fold_search_key, from_cyrillic, to_cyrillic, to_new_latin, to_old_latin

to_new_latin("O'zbekiston shaharlari")
# ConversionResult(text='Özbekiston şaharlari', warnings=())

to_old_latin("Özbekiston şaharlari").text
# 'Oʻzbekiston shaharlari'

result = from_cyrillic("Елена")
result.text
# 'Yelena'
result.warnings[0]
# Warning(index=0, length=1, rule='cyrillic.e.positional',
#         message='Cyrillic е can represent e or ye; a positional rule was applied.',
#         alternatives=('e', 'ye'))

to_cyrillic("Şavkat").text
# 'Шавкат'

fold_search_key("Шавкат") == fold_search_key("Shavkat")
# True

to_new_latin("MyShop shahar", protected_terms=["MyShop"]).text
# 'MyShop şahar'
```

## API

Conversion functions return a frozen `ConversionResult(text, warnings)`, where `warnings` is a tuple of frozen `Warning(index, length, rule, message, alternatives)` objects:

- `to_new_latin(text, **options)`: previous Latin to new Latin.
- `to_old_latin(text, **options)`: new Latin to previous Latin.
- `from_cyrillic(text, **options)`: Cyrillic to new Latin, with ambiguity warnings.
- `to_cyrillic(text, **options)`: new Latin to Cyrillic, with ambiguity warnings.

Their keyword-only options mirror the TypeScript `ConversionOptions`:

| Python            | TypeScript       | Default |
| ----------------- | ---------------- | ------- |
| `protect_spans`   | `protectSpans`   | `True`  |
| `protected_terms` | `protectedTerms` | `None`  |
| `exceptions`      | `exceptions`     | `None`  |
| `ng_as_digraph`   | `ngAsDigraph`    | `True`  |

The other functions take only `text`:

- `fold_search_key(text)`: canonical new-Latin, NFC, locale-independent lowercase key.
- `fold_search_key_loose(text)`: also strips diacritics. It can merge distinct words, so never use it as a unique key.
- `normalize_apostrophes(text)`: folds apostrophe-like characters to U+02BB after `o`/`g` and to U+02BC elsewhere.
- `normalize_confusables(text)`: NFC-normalizes text and folds known confusables such as U+0219 to U+015F.
- `detect_alphabet(text)`: returns `AlphabetDetection(alphabet, confidence)`. `alphabet` is one of `'cyrillic'`, `'old-latin'`, `'new-latin'`, `'mixed'`, or `'unknown'`.

## Differences from the TypeScript package

- **Warning offsets are Python string indexes (code points).** The TypeScript package reports UTF-16 code-unit offsets. The two are equal unless the text contains characters outside the Basic Multilingual Plane, such as emoji. For example, `from_cyrillic("😀 Елена")` reports warnings at indexes `[2, 4]` in Python and `[3, 5]` in JavaScript. Offsets refer to the NFC-normalized text after exceptions are applied, just as they do in TypeScript.
- Names are snake_case, options are keyword arguments, and results are immutable dataclasses with tuples instead of arrays.
- An empty string used as an `exceptions` key is ignored. The TypeScript package can loop forever on one.
- Unicode character properties come from the running Python's `unicodedata` module. Characters added in newer Unicode versions may be classified differently than they are by your JavaScript engine.

Casing never uses Python's built-in string case methods. It uses the same explicit Latin and Cyrillic tables as the TypeScript package, so the Turkish `İ`/`ı` problem cannot occur.

## Rules

The conversion pipeline, apostrophe handling, the `sʼh` boundary, Cyrillic ambiguity rules, and the open `ng` question are documented in the [main README](https://github.com/azakapro/alifbo#readme).

## Development

From the repository root:

```sh
npm ci && npm run build && node scripts/gen-python-parity.mjs
cd python
uv run --with pytest pytest
uv run --with ruff ruff check . && uv run --with ruff ruff format --check .
```

Released under the MIT License.
