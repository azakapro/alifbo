import { describe, expect, it } from 'vitest';
import {
  foldSearchKey,
  foldSearchKeyLoose,
  normalizeApostrophes,
  normalizeConfusables,
  toNewLatin,
  toOldLatin,
} from '../src/index.js';

describe('Latin conversion properties', () => {
  it('round-trips unambiguous old Latin strings', () => {
    let state = 0x5eed1234;
    const tokens = ['a', 'b', 'd', 'e', 'f', 'g', 'gʻ', 'h', 'i', 'j', 'k', 'l', 'm', 'n', 'ng', 'o', 'oʻ', 'p', 'q', 'r', 's', 'sh', 't', 'u', 'v', 'x', 'y', 'z', 'ch', 'ʼ'];
    for (let sample = 0; sample < 500; sample += 1) {
      let input = '';
      for (let length = 0; length < 24; length += 1) {
        state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
        input += tokens[state % tokens.length];
      }
      expect(toOldLatin(toNewLatin(input).text).text).toBe(normalizeApostrophes(input));
    }
  });

  it('honours custom exceptions longest-first', () => {
    expect(toNewLatin('shahar sh', { exceptions: { sh: 'X', shahar: 'Y' } }).text).toBe('Y X');
  });

  it('can disable all span protection', () => {
    expect(toNewLatin('https://x.uz/sh', { protectSpans: false }).text).toContain('/ş');
  });
});

describe('normalization and confusables', () => {
  it('folds comma-below s and never emits it', () => {
    expect(normalizeConfusables('ș Ș')).toBe('ş Ş');
    expect(toNewLatin('ș Ș sh').text).not.toMatch(/[șȘ]/u);
  });

  it('normalizes all apostrophe-like characters positionally', () => {
    expect(normalizeApostrophes("o' g’ a‘b c`d e´f h′i j＇k")).toBe('oʻ gʻ aʼb cʼd eʼf hʼi jʼk');
  });

  it('emits NFC and treats NFD input identically', () => {
    const nfc = 'Oʻzbekiston, şahar, gʻoya';
    const nfd = nfc.normalize('NFD');
    expect(toNewLatin(nfd).text).toBe(toNewLatin(nfc).text);
    expect(toNewLatin(nfd).text).toBe(toNewLatin(nfd).text.normalize('NFC'));
  });
});

describe('search keys', () => {
  it.each([
    ['Shavkat', 'Şavkat', 'Шавкат'],
    ['Oʻzbekiston', 'Özbekiston', 'Ўзбекистон'],
    ['Gʻulom', 'Ğulom', 'Ғулом'],
  ])('folds three alphabet spellings together', (oldLatin, newLatin, cyrillic) => {
    expect(foldSearchKey(oldLatin)).toBe(foldSearchKey(newLatin));
    expect(foldSearchKey(cyrillic)).toBe(foldSearchKey(newLatin));
  });

  it('keeps meaningful diacritics in the canonical key', () => {
    expect(foldSearchKey('ol')).not.toBe(foldSearchKey('öl'));
    expect(foldSearchKeyLoose('ol')).toBe(foldSearchKeyLoose('öl'));
  });

  it('never introduces Turkish dotted or dotless i', () => {
    for (const input of ['i I ish ISH И ИШ']) {
      expect(toNewLatin(input).text).not.toMatch(/[İı]/u);
      expect(foldSearchKey(input)).not.toMatch(/[İı]/u);
    }
  });
});
