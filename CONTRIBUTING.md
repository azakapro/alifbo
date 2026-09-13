# Contributing to alifbo

Correctness evidence is more valuable than adding broad heuristics. Please keep rule changes small, cite real Uzbek usage in the pull request, and represent genuine uncertainty with a warning or exception rather than a guess.

## Development setup

Use Node 20 or newer.

```sh
npm ci
npm run check
```

`npm run check` builds the ESM and CommonJS packages and declarations, runs ESLint and Prettier checks, and executes the complete Vitest suite.

## Adding a seed exception

1. Add the exact source-to-target word mapping to `src/data/exceptions.json`.
2. Add lower, title, and upper forms only when they are attested and needed. The core deliberately does not use locale-aware casing to synthesize variants.
3. Add a case to `test/corpus/latin.json` with `input`, `expected`, a stable `rule` identifier, and a note explaining the boundary or ambiguity.
4. Include a source or corpus citation in the pull request description. Do not add speculative forms.

Callers can try a mapping without changing the seed data:

```ts
toNewLatin('known-word', { exceptions: { 'known-word': 'verified-output' } });
```

Exceptions apply only at Unicode letter/number word boundaries. User-provided entries override seeded entries, and longer keys are tested first.

## Adding a golden case

Golden data lives in `test/corpus/*.json` and uses this schema:

```json
{
  "input": "source text",
  "expected": "exact output",
  "rule": "stable.rule.identifier",
  "note": "why this case matters"
}
```

Choose the file for the rule family: apostrophes, Latin conversion, protected spans, or Cyrillic conversion. Add a new corpus group only when the case does not fit an existing family. Include exact Unicode characters rather than lookalike escapes unless the codepoint itself is the subject of the test.

For every new mapping, consider all of these dimensions:

- lower, title, and upper case;
- NFC and NFD input;
- U+015F versus U+0219 confusables;
- every supported apostrophe form when relevant;
- word boundaries and adjacent punctuation;
- protected spans;
- a warning with alternatives if the mapping loses information.

Never introduce locale-aware `toUpperCase`, `toLowerCase`, `toLocaleUpperCase`, or `toLocaleLowerCase` calls. Extend the explicit table in `src/case.ts` instead.

## Changing the `ng` behavior

Do not change `ng` based on a news report alone. Link the enacted lex.uz text in the pull request, update `NG_DIGRAPH_OUTPUT` in `src/latin.ts`, update the README TODO/status, and add golden plus round-trip cases in the same change.
