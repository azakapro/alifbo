import { normalizeConfusables } from './normalize.js';
import type { Alphabet } from './types.js';

/** Return a best-effort alphabet classification and confidence score between zero and one. */
export function detectAlphabet(text: string): { alphabet: Alphabet; confidence: number } {
  const source = normalizeConfusables(text);
  const cyrillic = (source.match(/[А-Яа-яЁёЎўҚқҒғҲҳ]/gu) ?? []).length;
  const latin = (source.match(/[A-Za-zÖöĞğŞşÇç]/gu) ?? []).length;
  const newMarkers = (source.match(/[ÖöĞğŞşÇç]/gu) ?? []).length;
  const oldMarkers = (source.match(/(?:[OoGg][ʻʼ'‘’`´′＇]|[Ss][Hh]|[Cc][Hh])/gu) ?? []).length;

  if (cyrillic === 0 && latin === 0) return { alphabet: 'unknown', confidence: 0 };
  if (cyrillic > 0 && latin > 0) return { alphabet: 'mixed', confidence: 1 };
  if (cyrillic > 0) {
    // Latin branches use 0.7 plus marker density. Cyrillic has no separate
    // marker alphabet — ў қ ғ ҳ are the Uzbek-specific evidence — and a
    // one-letter hit should score below a full phrase.
    const uzbekSpecific = (source.match(/[ЎўҚқҒғҲҳ]/gu) ?? []).length;
    const lengthFactor = Math.min(1, cyrillic / 8);
    const specificFactor = uzbekSpecific / cyrillic;
    return {
      alphabet: 'cyrillic',
      confidence: Math.min(1, 0.55 + 0.35 * lengthFactor + 0.1 * specificFactor),
    };
  }
  if (newMarkers > 0 && oldMarkers > 0) return { alphabet: 'mixed', confidence: 0.9 };
  if (newMarkers > 0)
    return { alphabet: 'new-latin', confidence: Math.min(1, 0.7 + newMarkers / latin) };
  if (oldMarkers > 0)
    return { alphabet: 'old-latin', confidence: Math.min(1, 0.7 + oldMarkers / latin) };
  return { alphabet: 'old-latin', confidence: 0.55 };
}
