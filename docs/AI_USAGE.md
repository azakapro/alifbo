# Using alifbo with AI coding agents

This guide helps coding assistants integrate `alifbo` without reimplementing Uzbek transliteration or hiding ambiguous results.

## Recommended instruction

Give your coding agent this instruction with your application task:

> Use the published `alifbo` package for Uzbek alphabet conversion. Do not create new transliteration tables. Preserve `ConversionResult.warnings` for conversions involving Cyrillic, keep URLs/emails/code spans protected, and use `foldSearchKey` rather than converted display text for canonical search. Do not use `foldSearchKeyLoose` as a unique key.

## Install

```sh
npm install alifbo
```

The package provides ESM, CommonJS, browser-safe code, CLI support, and TypeScript declarations. It has no runtime dependencies and requires Node 20 or newer when used in Node.

## Integration patterns

### Convert user-visible text

```ts
import { toNewLatin } from 'alifbo';

const result = toNewLatin(input, {
  protectedTerms: ['OpenAI', 'ChatGPT'],
});

renderText(result.text);
```

Do not protect foreign words with an invented language detector. Supply verified brand names and proper nouns through `protectedTerms`.

### Handle Cyrillic uncertainty

```ts
import { fromCyrillic } from 'alifbo';

const result = fromCyrillic(input);

saveDraft(result.text);
if (result.warnings.length > 0) {
  showEditorialReview(result.warnings);
}
```

An agent must not discard `warnings` merely because the conversion returned text. Each warning identifies a source index, length, applied rule, explanation, and possible alternatives.

### Build alphabet-independent search

```ts
import { foldSearchKey, foldSearchKeyLoose } from 'alifbo';

const canonicalKey = foldSearchKey(name);
const typoTolerantKey = foldSearchKeyLoose(name);
```

Use `foldSearchKey` for the primary normalized index. Use the loose key only as an additional recall mechanism: it deliberately merges distinctions such as `ol` and `öl`.

### Route input

```ts
import { detectAlphabet, fromCyrillic, toNewLatin } from 'alifbo';

const detected = detectAlphabet(input);
const result = detected.alphabet === 'cyrillic' ? fromCyrillic(input) : toNewLatin(input);
```

`detectAlphabet` is best-effort. An agent should not treat its confidence as proof, especially for plain Latin text without alphabet-specific characters or for mixed content.

### Use the CLI from an automation

```sh
npx alifbo convert --to new-latin input.txt > output.txt
```

Converted text is written to stdout. Ambiguity warnings are written to stderr. An automation should capture both streams and surface stderr for review instead of suppressing it.

## Agent review checklist

Before accepting AI-generated integration code, verify that it:

- imports from `alifbo` instead of duplicating mapping tables;
- reads `.text` from the `ConversionResult` object;
- preserves or displays `.warnings` for Cyrillic conversion;
- does not apply locale-aware casing after conversion;
- does not modify protected text unexpectedly;
- stores canonical and loose search keys for different purposes;
- includes tests containing Uzbek Unicode characters, not visually similar substitutes;
- pins or records the package version through the project's lockfile.

## Working on alifbo itself

Agents contributing to this repository must follow [`AGENTS.md`](../AGENTS.md) and [`CONTRIBUTING.md`](../CONTRIBUTING.md). Linguistic changes require evidence and golden tests; a plausible model-generated rule is not sufficient.
