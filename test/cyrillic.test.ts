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

  it('warns when a Latin letter or stray ʻ has no Cyrillic mapping', () => {
    const result = toCyrillic('tongʻ w', { foreignWords: 'transliterate' });
    expect(result.text).toBe('тонгʻ w');
    expect(result.warnings).toHaveLength(2);
    expect(result.warnings.map((warning) => warning.rule)).toEqual([
      'latin.unmapped',
      'latin.unmapped',
    ]);
    expect(result.warnings.every((warning) => (warning.alternatives?.length ?? 0) === 0)).toBe(
      true,
    );
  });

  it('does not emit latin.unmapped for mapped letters or non-letters', () => {
    const result = toCyrillic('ton 12.');
    expect(result.text).toBe('тон 12.');
    expect(result.warnings.filter((warning) => warning.rule === 'latin.unmapped')).toHaveLength(0);
  });

  it('warns for fullwidth Ａ and feminine ordinal ª', () => {
    const transliterate = { foreignWords: 'transliterate' } as const;
    const rules = (text: string) =>
      toCyrillic(text, transliterate).warnings.map((warning) => warning.rule);
    expect(rules('Ａ')).toContain('latin.unmapped');
    expect(rules('ª')).toContain('latin.unmapped');
    // By default such letters make the whole word foreign instead.
    expect(toCyrillic('Ａ').warnings.map((warning) => warning.rule)).toEqual(['latin.foreign']);
  });

  it('does not warn for IPA ɐ', () => {
    const result = toCyrillic('ɐ');
    expect(result.warnings.filter((warning) => warning.rule === 'latin.unmapped')).toHaveLength(0);
  });
});

/** Sentences with foreign names inside Uzbek text; the output must never mix alphabets. */
const MIXED_SENTENCES = [
  'Toshkent hokimligi Microsoft Windows va Wi-Fi tizimiga oʻtdi. Zürich shahri, tongʻ.',
  'Yigʻilish Zoom va Google Meet orqali, hujjatlar Microsoft Word formatida.',
  'iPhone 15, Samsung Galaxy S24 va Xiaomi telefonlari sotuvda.',
  'Hisobot COVID-19 pandemiyasi davrida SiO2 va H2O tahlili haqida.',
  "Coca-Cola, McDonald's va Wendy's Toshkentda ochildi.",
  'YouTube, ChatGPT, LinkedIn va WhatsApp ilovalari.',
  'Oʻzbekiston Respublikasi Konstitutsiyasi 2026-yil 15-sentyabr.',
];

describe('foreign words in Latin → Cyrillic conversion', () => {
  it('keeps a word with letters Uzbek does not use and reports it once', () => {
    const text = 'Toshkent Windows shahri';
    const result = toCyrillic(text);
    expect(result.text).toBe('Тошкент Windows шаҳри');
    const foreign = result.warnings.filter((warning) => warning.rule === 'latin.foreign');
    expect(foreign).toHaveLength(1);
    expect(text.slice(foreign[0]!.index, foreign[0]!.index + foreign[0]!.length)).toBe('Windows');
    expect(foreign[0]!.alternatives).toEqual(['Windows', 'Wиндоwс']);
    expect(result.warnings.some((warning) => warning.rule === 'latin.unmapped')).toBe(false);
  });

  it('treats a bare c, mixed case and non-Uzbek diacritics as foreign, but not ch', () => {
    expect(toCyrillic('Microsoft').text).toBe('Microsoft');
    expect(toCyrillic('iPhone SiO2 ChatGPT').text).toBe('iPhone SiO2 ChatGPT');
    expect(toCyrillic('Zürich').text).toBe('Zürich');
    expect(toCyrillic('Chelsea chempion').text).toBe('Chelsea чемпион');
    expect(toCyrillic('Michael').text).toBe('Мичаэл');
  });

  it('keeps the whole word, including Uzbek suffixes and hyphenated parts', () => {
    expect(toCyrillic('Windowsda Wi-Fi-ga Coca-Cola').text).toBe('Windowsda Wi-Fi-ga Coca-Cola');
    expect(toCyrillic('Toshkent-Samarqand 2026-yil').text).toBe('Тошкент-Самарқанд 2026-йил');
    expect(toCyrillic("McDonald's").text).toBe("McDonald's");
  });

  it('leaves pure Uzbek text on the same path as before', () => {
    const text = 'Bu matnda hech qanday xorijiy harf yoʻq. Oʻzbekiston oʻzbek, Isʼhoq.';
    expect(toCyrillic(text)).toEqual(toCyrillic(text, { foreignWords: 'transliterate' }));
    expect(toCyrillic(text).warnings.some((warning) => warning.rule === 'latin.foreign')).toBe(
      false,
    );
  });

  it('converts letter by letter with foreignWords: transliterate', () => {
    const result = toCyrillic('Windows', { foreignWords: 'transliterate' });
    expect(result.text).toBe('Wиндоwс');
    expect(result.warnings.map((warning) => warning.rule)).toEqual([
      'latin.unmapped',
      'latin.unmapped',
    ]);
  });

  it("reports offsets into the caller's text around protected spans and old-Latin digraphs", () => {
    const text = 'shahar https://x.uz/Windows Windows choʻl Zürich';
    const result = toCyrillic(text);
    expect(result.text).toBe('шаҳар https://x.uz/Windows Windows чўл Zürich');
    const hits = result.warnings
      .filter((warning) => warning.rule === 'latin.foreign')
      .map((warning) => text.slice(warning.index, warning.index + warning.length));
    expect(hits).toEqual(['Windows', 'Zürich']);
  });

  it('never leaves a Latin letter after a Cyrillic one inside a word', () => {
    for (const sentence of MIXED_SENTENCES) {
      const { text } = toCyrillic(sentence);
      for (const word of text.split(/[^\p{L}\p{M}\p{N}ʻʼ'-]+/u)) {
        expect(word, `${word} in ${text}`).not.toMatch(/[\u0400-\u04ff][^\s]*[A-Za-z]/u);
      }
    }
  });
});
