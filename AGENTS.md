# Instructions for coding agents

These instructions apply to the entire repository.

## Purpose

`alifbo` is a reference-quality Uzbek transliteration library. Correctness, explicit uncertainty, Unicode fidelity, and backward compatibility matter more than adding features quickly.

## Required workflow

1. Read `README.md` and `CONTRIBUTING.md` before changing transliteration behavior.
2. Install exactly from the lockfile with `npm ci`.
3. Add or update tests before changing a conversion rule.
4. Run `npm run check` and `npx tsc --noEmit` before committing.
5. Inspect `npm pack --dry-run` whenever package metadata, exports, the CLI, or build output changes.

## Non-negotiable implementation rules

- Keep the core pure and free of runtime dependencies, file I/O, network access, and environment access. Node-specific behavior belongs only in `src/cli.ts` or development scripts.
- Never call `toUpperCase()`, `toLowerCase()`, `toLocaleUpperCase()`, or `toLocaleLowerCase()` in `src`. Extend the explicit mappings in `src/case.ts`.
- Always emit U+015F/U+015E for `ş`/`Ş`. Accept and fold U+0219/U+0218 as input confusables.
- Preserve protected URLs, email addresses, code spans, and caller-provided literal terms.
- Do not silently resolve ambiguous Cyrillic conversions. Return a structured `Warning` with alternatives.
- Do not invent linguistic rules. Use a documented exception for verified word-level behavior and preserve unresolved questions in the documentation.
- Do not alter the `ng` behavior without authoritative enacted-law evidence and matching golden tests.
- Keep ESM, CommonJS, browser, CLI, and declaration builds working.

## Tests and data

- Golden cases belong in `test/corpus/*.json` and require `input`, `expected`, `rule`, and `note`.
- Exception entries belong in `src/data/exceptions.json`; add lower/title/upper forms explicitly only when supported.
- Cover lowercase, title case, uppercase, NFC/NFD, confusables, apostrophe forms, protected spans, warning indexes, and round-trip behavior when relevant.
- A passing test is not evidence that a new linguistic rule is correct. Cite an authoritative source or attested corpus example in the pull request.

## Pull requests

Use a focused branch, keep unrelated changes out, explain any lossy behavior, and include the verification commands and results. Dependency updates must remain compatible with Node 20 and with the supported TypeScript/ESLint toolchain.
