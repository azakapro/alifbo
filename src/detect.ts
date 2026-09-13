import { normalizeConfusables } from './normalize.js';
import type { Alphabet } from './types.js';

export function detectAlphabet(text: string): { alphabet: Alphabet; confidence: number } {
  const source = normalizeConfusables(text);
  const cyrillic = (source.match(/[А-Яа-яЁёЎўҚқҒғҲҳ]/gu) ?? []).length;
  const latin = (source.match(/[A-Za-zÖöĞğŞşÇç]/gu) ?? []).length;
  const newMarkers = (source.match(/[ÖöĞğŞşÇç]/gu) ?? []).length;
  const oldMarkers = (source.match(/(?:[OoGg][ʻʼ'‘’`´′＇]|[Ss][Hh]|[Cc][Hh])/gu) ?? []).length;

  if (cyrillic === 0 && latin === 0) return { alphabet: 'unknown', confidence: 0 };
  if (cyrillic > 0 && latin > 0) return { alphabet: 'mixed', confidence: 1 };
  if (cyrillic > 0) return { alphabet: 'cyrillic', confidence: cyrillic / Math.max(1, cyrillic) };
  if (newMarkers > 0 && oldMarkers > 0) return { alphabet: 'mixed', confidence: 0.9 };
  if (newMarkers > 0)
    return { alphabet: 'new-latin', confidence: Math.min(1, 0.7 + newMarkers / latin) };
  if (oldMarkers > 0)
    return { alphabet: 'old-latin', confidence: Math.min(1, 0.7 + oldMarkers / latin) };
  return { alphabet: 'old-latin', confidence: 0.55 };
}
