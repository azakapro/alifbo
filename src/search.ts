import { lowerText } from './case.js';
import { fromCyrillic } from './cyrillic.js';
import { toNewLatin } from './latin.js';
import { normalizeConfusables } from './normalize.js';

/** Produce a canonical, NFC, locale-independent lowercase search key from any alphabet. */
export function foldSearchKey(text: string): string {
  const cyrillicConverted = fromCyrillic(text).text;
  return lowerText(normalizeConfusables(toNewLatin(cyrillicConverted).text)).normalize('NFC');
}

/** Produce a typo-tolerant search key that also strips diacritics and may merge distinct words. */
export function foldSearchKeyLoose(text: string): string {
  return foldSearchKey(text).normalize('NFD').replace(/\p{M}/gu, '').normalize('NFC');
}
