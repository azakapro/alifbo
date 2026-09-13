import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { fromCyrillic, toNewLatin } from '../src/index.js';

interface GoldenCase {
  input: string;
  expected: string;
  rule: string;
  note: string;
}

function corpus(name: string): GoldenCase[] {
  const url = new URL(`corpus/${name}.json`, import.meta.url);
  return JSON.parse(readFileSync(fileURLToPath(url), 'utf8')) as GoldenCase[];
}

describe.each(['apostrophes', 'latin', 'protected'])('%s golden corpus', (name) => {
  for (const testCase of corpus(name)) {
    it(`${testCase.rule}: ${testCase.note}`, () => {
      expect(toNewLatin(testCase.input).text).toBe(testCase.expected);
    });
  }
});

describe('Cyrillic golden corpus', () => {
  for (const testCase of corpus('cyrillic')) {
    it(`${testCase.rule}: ${testCase.note}`, () => {
      expect(fromCyrillic(testCase.input).text).toBe(testCase.expected);
    });
  }
});
