import { describe, expect, it } from 'vitest';
import { fromCyrillic, toCyrillic, toNewLatin, toOldLatin } from '../src/index.js';

describe('Cyrillic е/э and ye round-trips', () => {
  // Inverse of the documented fromCyrillic rule: е is "ye" at a word start, after a
  // vowel, or after ъ/ь, and "e" elsewhere; э is always "e".
  it.each([
    ['Европа', 'Yevropa'],
    ['ер', 'yer'],
    ['поезд', 'poyezd'],
    ['подъезд', 'podʼyezd'],
    ['экран', 'ekran'],
    ['Экран', 'Ekran'],
    ['поэт', 'poet'],
    ['театр', 'teatr'],
    ['келди', 'keldi'],
    ['ЕР', 'YER'],
  ])('round-trips %s through %s', (cyrillic, latin) => {
    expect(fromCyrillic(cyrillic).text).toBe(latin);
    expect(toCyrillic(latin).text).toBe(cyrillic);
  });

  it('warns about the positional choices it makes', () => {
    expect(toCyrillic('yer').warnings).toEqual([
      expect.objectContaining({ rule: 'latin.ye.positional', index: 0, length: 2 }),
    ]);
    expect(toCyrillic('ekran').warnings[0]).toMatchObject({
      rule: 'latin.e.ambiguous',
      alternatives: ['э', 'е'],
    });
    expect(toCyrillic('keldi').warnings[0]).toMatchObject({
      rule: 'latin.e.ambiguous',
      alternatives: ['е', 'э'],
    });
  });
});

describe('all-uppercase words', () => {
  it('keeps multi-letter replacements uppercase at the end of a word', () => {
    expect(toOldLatin('QUYOŞ TOŞKENT ÇÖL').text).toBe('QUYOSH TOSHKENT CHOʻL');
    expect(toOldLatin('OŞ').text).toBe('OSH');
    expect(toOldLatin('Ş Şahar').text).toBe('Sh Shahar');
  });

  it('keeps Cyrillic expansions uppercase inside uppercase words', () => {
    expect(fromCyrillic('ЁЗУВ ЮРТ ЯНГИ ЩЁТКА').text).toBe('YOZUV YURT YANGI ŞÇYOTKA');
    expect(fromCyrillic('Ёзув Ё').text).toBe('Yozuv Yo');
  });
});

describe('exceptions', () => {
  it('ignores an empty exception key instead of looping forever', () => {
    expect(toNewLatin(' sh', { exceptions: { '': 'X' } }).text).toBe(' ş');
  });

  it('respects word boundaries next to astral letters', () => {
    expect(toNewLatin('𝐀shahar shahar', { exceptions: { shahar: 'Y' } }).text).toBe('𝐀şahar Y');
  });
});

describe('warning offsets point into the caller’s text', () => {
  it('accounts for old-Latin digraphs before converting to Cyrillic', () => {
    const result = toCyrillic('Shahar teatr');
    expect(result.text).toBe('Шаҳар театр');
    expect(result.warnings[0]).toMatchObject({ rule: 'latin.e.ambiguous', index: 8, length: 1 });
  });

  it('accounts for exceptions that change length', () => {
    const result = fromCyrillic('Шавкат ер', { exceptions: { Шавкат: 'X' } });
    expect(result.text).toBe('X yer');
    expect(result.warnings[0]).toMatchObject({ rule: 'cyrillic.e.positional', index: 7 });
  });

  it('accounts for NFC composition of decomposed input', () => {
    const decomposed = 'й ер';
    const result = fromCyrillic(decomposed);
    expect(result.text).toBe('y yer');
    expect(result.warnings[0]).toMatchObject({ index: 3, length: 1 });
    expect(decomposed[3]).toBe('е');
  });

  it('spans every source character of a replaced digraph', () => {
    const result = toCyrillic('Sheʼr');
    expect(result.warnings.map(({ rule, index, length }) => [rule, index, length])).toEqual([
      ['latin.e.ambiguous', 2, 1],
      ['latin.tutuq.ambiguous', 3, 1],
    ]);
  });
});

describe('astral characters', () => {
  it('treats an astral letter as a letter for positional е', () => {
    expect(fromCyrillic('𝐀е').text).toBe('𝐀e');
    expect(fromCyrillic('😀 е').text).toBe('😀 ye');
  });
});

describe('soft sign', () => {
  it.each([
    ['батальон', 'batalyon'],
    ['павильон', 'pavilyon'],
    ['бульон', 'bulyon'],
    ['БАТАЛЬОН', 'BATALYON'],
    ['медаль', 'medal'],
    ['Ильич', 'Iliç'],
    ['серьёзно', 'seryozno'],
    ['ь', ''],
  ])('converts %s to %s', (cyrillic, latin) => {
    expect(fromCyrillic(cyrillic).text).toBe(latin);
  });

  it('explains the glide in the warning', () => {
    expect(fromCyrillic('бульон').warnings[0]).toMatchObject({
      rule: 'cyrillic.soft-sign.ambiguous',
      alternatives: ['y', ''],
    });
  });
});
