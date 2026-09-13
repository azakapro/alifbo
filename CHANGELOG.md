# Changelog

All notable changes to this project are documented here. The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and the project uses [Semantic Versioning](https://semver.org/).

## [Unreleased]

## [0.1.1] - 2026-09-13

### Added

- Repository, issue tracker, homepage, and discovery metadata for npm.
- ESM, CommonJS, and CLI smoke verification in the release check.
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

[Unreleased]: https://github.com/azakapro/alifbo/compare/v0.1.1...HEAD
[0.1.1]: https://github.com/azakapro/alifbo/compare/v0.1.0...v0.1.1
[0.1.0]: https://github.com/azakapro/alifbo/releases/tag/v0.1.0
