import { lowerText } from './case.js';
import { fromCyrillic } from './cyrillic.js';
import { toNewLatin } from './latin.js';
import { normalizeConfusables } from './normalize.js';

export function foldSearchKey(text: string): string {
  const cyrillicConverted = fromCyrillic(text).text;
  return lowerText(normalizeConfusables(toNewLatin(cyrillicConverted).text)).normalize('NFC');
}

export function foldSearchKeyLoose(text: string): string {
  return foldSearchKey(text).normalize('NFD').replace(/\p{M}/gu, '').normalize('NFC');
}
