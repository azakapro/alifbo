# Changelog

All notable changes to this project are documented here. The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and the project uses [Semantic Versioning](https://semver.org/).

## [Unreleased]

### Added

- `toCyrillic` reports a `latin.unmapped` warning (with no alternatives) for every Latin letter it has to leave unchanged, such as `w`, and for a stray `ʻ` that is not part of `oʻ` or `gʻ`. The demo's review panel lists them in all three languages (#15, fixes #8, thanks @team-humaki).

## [0.3.0] - 2026-09-14

### Added

- Browser demo: light and dark themes (follows the system, with a remembered override), Text and Document tabs, page-wide file drop, Uzbek/Russian/English interface, "About" and developer panels, link preview image, content-hashed assets, and a cross-browser test (Chromium, Firefox, WebKit) that runs before every deploy.
- `detectAlphabet` scales Cyrillic confidence with the amount of evidence instead of always returning 1 (#14, thanks @team-humaki).
- Demo: open Word `.docx` files and download the converted document with its formatting, tables, headers and footers intact, plus `.srt` subtitles and drag-and-drop. Supported formats are listed on the page.
- Demo: Russian interface.

### Changed

- The soft sign before a plain vowel is written as `y` (`батальон` → `batalyon`, `бульон` → `bulyon`); elsewhere it is still dropped (`медаль` → `medal`).
- The demo's review panel lists only rules that can really be wrong (ц, щ, standalone c, ts, unmapped letters). The library still reports every positional choice.

## [0.2.0] - 2026-09-13

### Added

- Python port in `python/` (`pip install alifbo`) with the same behavior, snake_case names, and Python string-index warning offsets. A parity fixture generated from the TypeScript build by `scripts/gen-python-parity.mjs` keeps the two in sync, and CI checks it.
- Browser demo at https://azakapro.github.io/alifbo/, deployed from `site/` by GitHub Pages.
- Release workflow that publishes npm and PyPI packages with trusted publishing from a version tag.
- `latin.ye.positional` warning for `toCyrillic`.

### Changed

- `toCyrillic` inverts the positional `е` rule so Cyrillic round-trips: `ye` at a word start, after a vowel, or after tutuq becomes `е`, and a bare `e` there becomes `э` (previously `Yevropa` → `Йевропа`, `ekran` → `екран`).
- Warning `index`/`length` now point into the caller's text instead of the internally normalized text (affects NFD input, length-changing exceptions, and old-Latin input to `toCyrillic`).

### Fixed

- All-uppercase words keep multi-letter replacements uppercase at word end (`QUYOŞ` → `QUYOSH`, `ЩЁТКА` → `ŞÇYOTKA`).
- An empty key in `exceptions` no longer causes an infinite loop.
- Astral letters (for example mathematical letters) count as letters for exception word boundaries and positional `е`/`ц` rules.
- Converting very long documents with many warnings no longer risks a stack overflow.

## [0.1.1] - 2026-09-13

### Added

- Repository, issue tracker, homepage, and discovery metadata for npm.
- ESM, CommonJS, CLI, and browser-bundle smoke verification in the release check.
- Node 20 and Node 22 CI coverage.
- Community health files, structured issue forms, and release notes configuration.
- CLI help output.

### Fixed

- The CLI now writes lossy-conversion warnings to standard error instead of silently discarding them.

## [0.1.0] - 2026-09-13

### Added

- Old Latin, new Latin, and Cyrillic conversion APIs.
- Structured warnings for lossy Cyrillic conversion.
- Apostrophe normalization, confusable folding, protected spans, and exception data.
- Alphabet-independent canonical and loose search keys.
- Alphabet detection and a Node CLI.
- ESM, CommonJS, and TypeScript declaration builds.
- Golden corpus, property, normalization, casing, search, CLI, and ambiguity tests.

[Unreleased]: https://github.com/azakapro/alifbo/compare/v0.3.0...HEAD
[0.3.0]: https://github.com/azakapro/alifbo/compare/v0.2.0...v0.3.0
[0.2.0]: https://github.com/azakapro/alifbo/compare/v0.1.1...v0.2.0
[0.1.1]: https://github.com/azakapro/alifbo/compare/v0.1.0...v0.1.1
[0.1.0]: https://github.com/azakapro/alifbo/releases/tag/v0.1.0
