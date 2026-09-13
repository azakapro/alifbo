import { describe, expect, it } from 'vitest';
import { detectAlphabet } from '../src/index.js';

describe('alphabet detection', () => {
  it.each([
    ['Шавкат', 'cyrillic'],
    ['Oʻzbekiston shahar', 'old-latin'],
    ['Özbekiston şahar', 'new-latin'],
    ['Шавкат Şavkat', 'mixed'],
    ['123 !?', 'unknown'],
  ] as const)('detects %s as %s', (input, alphabet) => {
    const result = detectAlphabet(input);
    expect(result.alphabet).toBe(alphabet);
    expect(result.confidence).toBeGreaterThanOrEqual(0);
    expect(result.confidence).toBeLessThanOrEqual(1);
  });

  it('scales cyrillic confidence with evidence', () => {
    const one = detectAlphabet('Ў');
    const sentence = detectAlphabet('Ўзбекистонда қишлоқ хўжалиги ривожланмоқда');
    expect(one.alphabet).toBe('cyrillic');
    expect(sentence.alphabet).toBe('cyrillic');
    expect(one.confidence).toBeGreaterThan(0);
    expect(one.confidence).toBeLessThan(1);
    expect(sentence.confidence).toBeGreaterThan(one.confidence);
    expect(sentence.confidence).toBeLessThanOrEqual(1);
  });
});
