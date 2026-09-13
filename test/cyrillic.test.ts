import { describe, expect, it } from 'vitest';
import { fromCyrillic, toCyrillic } from '../src/index.js';

describe('lossy Cyrillic conversion', () => {
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
    expect(result.text).toBe('е щ ё ю я ъ');
    expect(result.warnings.length).toBeGreaterThanOrEqual(6);
    expect(result.warnings[0]).toMatchObject({ index: 0, length: 1 });
  });
});
