import { describe, expect, it } from 'vitest';
import { fromCyrillic, toCyrillic } from '../src/index.js';

describe('lossy Cyrillic conversion', () => {
  const directMappings = [
    ['а', 'А', 'a', 'A'],
    ['б', 'Б', 'b', 'B'],
    ['в', 'В', 'v', 'V'],
    ['г', 'Г', 'g', 'G'],
    ['д', 'Д', 'd', 'D'],
    ['ж', 'Ж', 'j', 'J'],
    ['з', 'З', 'z', 'Z'],
    ['и', 'И', 'i', 'I'],
    ['й', 'Й', 'y', 'Y'],
    ['к', 'К', 'k', 'K'],
    ['л', 'Л', 'l', 'L'],
    ['м', 'М', 'm', 'M'],
    ['н', 'Н', 'n', 'N'],
    ['о', 'О', 'o', 'O'],
    ['п', 'П', 'p', 'P'],
    ['р', 'Р', 'r', 'R'],
    ['с', 'С', 's', 'S'],
    ['т', 'Т', 't', 'T'],
    ['у', 'У', 'u', 'U'],
    ['ф', 'Ф', 'f', 'F'],
    ['х', 'Х', 'x', 'X'],
    ['ч', 'Ч', 'ç', 'Ç'],
    ['ш', 'Ш', 'ş', 'Ş'],
    ['ы', 'Ы', 'i', 'I'],
    ['э', 'Э', 'e', 'E'],
    ['ў', 'Ў', 'ö', 'Ö'],
    ['қ', 'Қ', 'q', 'Q'],
    ['ғ', 'Ғ', 'ğ', 'Ğ'],
    ['ҳ', 'Ҳ', 'h', 'H'],
  ] as const;

  const reverseMappings = [
    ['a', 'A', 'а', 'А'],
    ['b', 'B', 'б', 'Б'],
    ['v', 'V', 'в', 'В'],
    ['g', 'G', 'г', 'Г'],
    ['d', 'D', 'д', 'Д'],
    ['e', 'E', 'э', 'Э'], // a lone e starts a word, where Cyrillic uses э
    ['j', 'J', 'ж', 'Ж'],
    ['z', 'Z', 'з', 'З'],
    ['i', 'I', 'и', 'И'],
    ['y', 'Y', 'й', 'Й'],
    ['k', 'K', 'к', 'К'],
    ['l', 'L', 'л', 'Л'],
    ['m', 'M', 'м', 'М'],
    ['n', 'N', 'н', 'Н'],
    ['o', 'O', 'о', 'О'],
    ['p', 'P', 'п', 'П'],
    ['r', 'R', 'р', 'Р'],
    ['s', 'S', 'с', 'С'],
    ['t', 'T', 'т', 'Т'],
    ['u', 'U', 'у', 'У'],
    ['f', 'F', 'ф', 'Ф'],
    ['x', 'X', 'х', 'Х'],
    ['ç', 'Ç', 'ч', 'Ч'],
    ['ş', 'Ş', 'ш', 'Ш'],
    ['ö', 'Ö', 'ў', 'Ў'],
    ['q', 'Q', 'қ', 'Қ'],
    ['ğ', 'Ğ', 'ғ', 'Ғ'],
    ['h', 'H', 'ҳ', 'Ҳ'],
  ] as const;

  it.each(directMappings)(
    'maps %s/%s directly to %s/%s',
    (lower, upper, latinLower, latinUpper) => {
      expect(fromCyrillic(lower)).toEqual({ text: latinLower, warnings: [] });
      expect(fromCyrillic(upper)).toEqual({ text: latinUpper, warnings: [] });
    },
  );

  it.each(reverseMappings)(
    'maps new Latin %s/%s to Cyrillic %s/%s',
    (lower, upper, cyrillicLower, cyrillicUpper) => {
      expect(toCyrillic(lower).text).toBe(cyrillicLower);
      expect(toCyrillic(upper).text).toBe(cyrillicUpper);
    },
  );

  it('warns at each ambiguous source construct', () => {
    const result = fromCyrillic('е ц щ ъ ь ё ю я');
    expect(result.warnings).toHaveLength(8);
    expect(result.warnings.map((warning) => warning.rule)).toEqual([
      'cyrillic.e.positional',
      'cyrillic.tse.positional',
      'cyrillic.shcha.ambiguous',
      'cyrillic.hard-sign.ambiguous',
      'cyrillic.soft-sign.ambiguous',
      'cyrillic.yo.compound',
      'cyrillic.yu.compound',
      'cyrillic.ya.compound',
    ]);
    expect(result.warnings.every((warning) => (warning.alternatives?.length ?? 0) > 1)).toBe(true);
  });

  it('warns for ambiguous reverse choices with source indexes', () => {
    const result = toCyrillic('e şç yo yu ya ʼ');
    expect(result.text).toBe('э щ ё ю я ъ');
    expect(result.warnings.length).toBeGreaterThanOrEqual(6);
    expect(result.warnings[0]).toMatchObject({ index: 0, length: 1 });
  });

  it('keeps warning offsets anchored to source text around protected spans', () => {
    const prefix = 'https://example.uz/е ';
    const result = fromCyrillic(`${prefix}Елена`);
    expect(result.text).toBe(`${prefix}Yelena`);
    expect(result.warnings[0]?.index).toBe(prefix.length);
    expect(result.warnings.map(({ index }) => index)).toEqual([prefix.length, prefix.length + 2]);
  });

  it('does not transliterate protected spans in either direction', () => {
    expect(fromCyrillic('`Шавкат` Шавкат').text).toBe('`Шавкат` Şavkat');
    expect(toCyrillic('https://example.uz/sh Şavkat').text).toBe('https://example.uz/sh Шавкат');
  });
});
