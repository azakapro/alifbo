# alifbo

[![CI](https://github.com/azakapro/alifbo/actions/workflows/ci.yml/badge.svg)](https://github.com/azakapro/alifbo/actions/workflows/ci.yml)
[![npm](https://img.shields.io/npm/v/alifbo)](https://www.npmjs.com/package/alifbo)
[![license](https://img.shields.io/npm/l/alifbo)](./LICENSE)

`alifbo` is a zero-runtime-dependency TypeScript library for converting Uzbek text between Cyrillic, the previous Latin alphabet, and the Latin alphabet approved by Uzbekistan's Senate in September 2026. It is designed to expose uncertainty instead of hiding it.

**Try it in your browser:** [azakapro.github.io/alifbo](https://azakapro.github.io/alifbo/) (no install; your text never leaves the page).
The demo counts anonymous visits and feature use with [GoatCounter](https://www.goatcounter.com) (no cookies, no IP addresses, and never any text or file names; Do Not Track is respected). The npm and Python libraries send nothing.

The package works in Node 20+ and browsers, and publishes ESM, CommonJS, and TypeScript declarations. The core API is pure: it performs no I/O, network access, or environment inspection.

> **Legal status:** the Senate approved the amending law, but the new alphabet was not yet in force at the time of this release. Follow the [official Senate announcement](https://senat.uz/plenary-sessions/post-6002) and the [QL-236 legislative record on lex.uz](https://lex.uz/docs/-8413368) for authoritative updates.

## Alphabet change

| Previous Latin | New Latin | Lower / upper codepoints |
| -------------- | --------- | ------------------------ |
| `oʻ`           | `ö`       | U+00F6 / U+00D6          |
| `gʻ`           | `ğ`       | U+011F / U+011E          |
| `sh`           | `ş`       | U+015F / U+015E          |
| `ch`           | `ç`       | U+00E7 / U+00C7          |

The `ş` emitted by this package is **U+015F LATIN SMALL LETTER S WITH CEDILLA**, never U+0219 (s with comma below). Fonts often make the two look nearly identical, but search, equality, and database indexes do not. U+0219/U+0218 input is accepted and folded to U+015F/U+015E.

## Install and use

```sh
npm install alifbo
```

```ts
import { foldSearchKey, fromCyrillic, toNewLatin } from 'alifbo';

toNewLatin("O'zbekiston shaharlari");
// { text: 'Özbekiston şaharlari', warnings: [] }

fromCyrillic('Елена');
// {
//   text: 'Yelena',
//   warnings: [{ rule: 'cyrillic.e.positional', alternatives: ['e', 'ye'], ... }]
// }

foldSearchKey('Шавкат') === foldSearchKey('Shavkat'); // true
```

CommonJS is supported too:

```js
const { toNewLatin } = require('alifbo');
```

### Python

A Python 3.9+ port with the same behavior and snake_case names lives in [`python/`](./python/README.md):

```sh
pip install alifbo
```

```python
from alifbo import to_new_latin

to_new_latin("O'zbekiston shaharlari").text  # 'Özbekiston şaharlari'
```

Its warning offsets are Python string indexes rather than UTF-16 offsets; see the [Python README](./python/README.md) for details.

The public functions are:

- `toNewLatin(text, options)` — previous Latin to new Latin.
- `toOldLatin(text, options)` — new Latin to previous Latin.
- `fromCyrillic(text, options)` — Cyrillic to new Latin, with ambiguity warnings.
- `toCyrillic(text, options)` — new Latin to Cyrillic, with ambiguity warnings.
- `foldSearchKey(text)` — canonical new-Latin, NFC, locale-independent lowercase key.
- `foldSearchKeyLoose(text)` — additionally strips diacritics; useful for typo-tolerant search but deliberately lossier.
- `normalizeApostrophes(text)` — positionally folds apostrophe-like characters to U+02BB or U+02BC.
- `normalizeConfusables(text)` — NFC-normalizes and folds known visual confusables.
- `detectAlphabet(text)` — best-effort routing hint with a confidence score.

### Options

```ts
interface ConversionOptions {
  protectSpans?: boolean; // default true
  protectedTerms?: string[];
  exceptions?: Record<string, string>;
  ngAsDigraph?: boolean; // default true
}
```

URLs, email addresses, backtick code spans, and seeded foreign names (`Shakespeare`, `Chelsea`, and `Photoshop`) are protected by default. `protectedTerms` adds exact literal spans. Set `protectSpans: false` to convert everything. User exceptions are word-level, take precedence over seeded exceptions, and are applied longest-first.

## Explicit conversion pipeline

Each conversion uses these stages:

1. Extract protected spans.
2. Normalize unprotected text to NFC.
3. Fold confusables such as U+0219 to U+015F.
4. Normalize apostrophes positionally.
5. Apply word exceptions, longest match first.
6. Protect the `s` + U+02BC tutuq + `h` morpheme boundary, then process digraphs.
7. Convert `oʻ` to `ö` and `gʻ` to `ğ` (performed in the same single-pass rule engine as step 6).
8. Restore protected spans byte-for-byte.

Protected spans are restored literally. Consequently, an intentionally protected span containing NFD text remains NFD even though converted text is always NFC.

## Apostrophes and the `sʼh` boundary

The input characters U+02BB, U+02BC, U+0027, U+2018, U+2019, U+0060, U+00B4, U+2032, and U+FF07 are accepted. Immediately after `o` or `g` (in either case), they normalize to U+02BB, the letter modifier. Elsewhere they normalize to U+02BC, the tutuq belgisi.

`asʼhob` and `Isʼhoq` contain `s` and `h` separated by a real morpheme boundary, so they must not become `aşob` or `Işoq`. When the tutuq has already been dropped, the distinction cannot be recovered by a general rule. The package therefore includes a deliberately small seed exception dictionary. It is incomplete; contributions backed by examples are welcome.

## Cyrillic warnings

Cyrillic conversion cannot be fully reversible. Positional `е`, ambiguous `ц`, `щ`, the hard and soft signs, and expanded `ё`, `ю`, and `я` produce structured warnings. Reverse conversion likewise warns when choosing among `е`/`э`, `щ`/`шч`, `ц`/`тс`, one-letter iotated forms, and interpretations of the tutuq sign. Warning indexes and lengths use JavaScript UTF-16 string offsets into the text you passed in, even when normalization, exceptions, or the old-to-new Latin pre-pass change lengths.

The default positional rules are intentionally mechanical:

- `е` becomes `ye` at a word start, after a vowel, or after `ъ`/`ь`; otherwise it becomes `e`.
- `ц` becomes `s` at a word start (and for the second letter of `цц`); otherwise it becomes `ts`.
- `ъ` becomes U+02BC; `ь` is dropped.
- `щ`, `ё`, `ю`, and `я` become `şç`, `yo`, `yu`, and `ya`.

`toCyrillic` applies the inverse rule, so words round-trip: at a word start, after a vowel, or after the tutuq sign, `ye` becomes `е` and a bare `e` becomes `э` (`Yevropa` → `Европа`, `ekran` → `экран`, `poet` → `поэт`, `podʼyezd` → `подъезд`); elsewhere `e` becomes `е`.

Inspect `warnings` whenever converting to or from Cyrillic, and use a word exception when the default is wrong for a known term.

## Locale-independent casing

The implementation never calls `toUpperCase()` or `toLowerCase()`. It uses explicit case tables for Latin and Cyrillic. This avoids the Turkish-locale `i` → `İ` and `I` → `ı` trap, which can silently corrupt Uzbek identifiers and search keys.

## The `ng` rule

Reporting on the Senate-approved text [says](https://www.gazeta.uz/en/2026/09/10/uzb-alphabet/) that `ng` is removed from the alphabet as a letter, but the letter combination itself is kept and governed by spelling rules. Either way, `ng` is written as `ng`. This still needs to be confirmed against the enacted law text in the [QL-236 record on lex.uz](https://lex.uz/docs/-8413368). Until then, `ngAsDigraph` defaults to `true`. With that setting it is consumed atomically and left unchanged. Setting it to `false` treats `n` and `g` as ordinary adjacent letters; the visible result is currently still `ng`. The behavior is isolated behind the single `NG_DIGRAPH_OUTPUT` data constant so an authoritative replacement requires no pipeline refactor.

## Deliberate non-goals

`alifbo` does not guess whether an unmarked word is foreign, reconstruct arbitrary dropped apostrophes, perform morphological analysis, correct spelling, or promise lossless Cyrillic round-trips. Brand names and other foreign terms must be protected explicitly. `foldSearchKeyLoose` can merge genuinely distinct words (for example `ol` and `öl`) and must not be used as a unique database key.

## CLI

The CLI is a separate Node-only entry point; the browser-safe core never imports it.

```sh
alifbo convert --to new-latin file.txt
cat file.txt | alifbo convert --to cyrillic
alifbo convert --to old-latin < input.txt > output.txt
```

Input files are read without modification. Converted text is written to standard output.
Ambiguity warnings are written separately to standard error, so redirected output remains clean:

```text
alifbo: warning [cyrillic.e.positional] at 0:1: ...
```

## Author

Built by **Azizullo Temirov**. I share progress on alifbo and other projects here:

[Telegram](https://t.me/azaka_notes) · [YouTube](https://www.youtube.com/@azizullotm) · [Instagram](https://www.instagram.com/azakapro/) · [LinkedIn](https://www.linkedin.com/in/azizullo/)

Found a wrong conversion? [Open an issue](https://github.com/azakapro/alifbo/issues/new/choose) with the exact input and the expected output.

## Development

```sh
npm ci
npm run check
```

Using an AI coding assistant? Give it the [AI integration guide](https://github.com/azakapro/alifbo/blob/main/docs/AI_USAGE.md). Agents modifying this repository should follow [AGENTS.md](https://github.com/azakapro/alifbo/blob/main/AGENTS.md).

See the [contribution guide](https://github.com/azakapro/alifbo/blob/main/CONTRIBUTING.md) for adding exceptions and golden cases, the [changelog](./CHANGELOG.md) for release history, and the [security policy](https://github.com/azakapro/alifbo/security/policy) for vulnerability reporting. Released under the MIT License.
