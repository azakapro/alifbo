import { firstCase, isUpper, lowerChar, upperText } from './case.js';
import { applyExceptions, mapSegments, mapSegmentsMapped } from './pipeline.js';
import { originAt, prepareText, prepareTextMapped } from './normalize.js';
import type { ConversionOptions, ConversionResult } from './types.js';

// TODO(ng): Change only this value if the authoritative law assigns a new single letter.
const NG_DIGRAPH_OUTPUT = 'ng';

function isPairAt(text: string, index: number, first: string, second: string): boolean {
  return lowerChar(text[index] ?? '') === first && lowerChar(text[index + 1] ?? '') === second;
}

/**
 * Previous Latin to new Latin. With `track`, also records the source offset of every output
 * code unit (needed only to anchor toCyrillic warnings); otherwise `origins` is empty.
 */
export function oldLatinCoreMapped(
  text: string,
  options: ConversionOptions = {},
  offset = 0,
  track = true,
): { text: string; origins: number[] } {
  const prepared = track ? prepareTextMapped(text) : { text: prepareText(text), origins: null };
  const { text: source, origins } = applyExceptions(prepared, options);
  let output = '';
  const outputOrigins: number[] = [];
  const emit = (piece: string, sourceIndex: number) => {
    output += piece;
    if (!track) return;
    const origin = offset + originAt(origins, sourceIndex);
    for (let unit = 0; unit < piece.length; unit += 1) outputOrigins.push(origin);
  };

  let index = 0;
  while (index < source.length) {
    const character = source[index]!;
    const next = source[index + 1];

    if ((lowerChar(character) === 'o' || lowerChar(character) === 'g') && next === 'ʻ') {
      emit(firstCase(character, lowerChar(character) === 'o' ? 'ö' : 'ğ'), index);
      index += 2;
      continue;
    }
    if (
      lowerChar(character) === 's' &&
      next === 'ʼ' &&
      lowerChar(source[index + 2] ?? '') === 'h'
    ) {
      emit(character, index);
      emit(next, index + 1);
      emit(source[index + 2]!, index + 2);
      index += 3;
      continue;
    }
    if (isPairAt(source, index, 's', 'h')) {
      emit(firstCase(character, 'ş'), index);
      index += 2;
      continue;
    }
    if (isPairAt(source, index, 'c', 'h')) {
      emit(firstCase(character, 'ç'), index);
      index += 2;
      continue;
    }
    if (options.ngAsDigraph !== false && isPairAt(source, index, 'n', 'g')) {
      if (NG_DIGRAPH_OUTPUT === 'ng') {
        emit(source[index]!, index);
        emit(source[index + 1]!, index + 1);
      } else {
        emit(firstCase(character, NG_DIGRAPH_OUTPUT), index);
      }
      index += 2;
      continue;
    }
    emit(character, index);
    index += 1;
  }
  const normalized = output.normalize('NFC');
  if (!track) return { text: normalized, origins: outputOrigins };
  outputOrigins.push(offset + originAt(origins, source.length));
  if (normalized.length !== output.length) {
    const end = outputOrigins[outputOrigins.length - 1]!;
    return {
      text: normalized,
      origins: Array.from({ length: normalized.length + 1 }, (_, unit) =>
        Math.min(outputOrigins[unit] ?? end, end),
      ),
    };
  }
  return { text: normalized, origins: outputOrigins };
}

export function oldLatinCore(text: string, options: ConversionOptions = {}): string {
  return oldLatinCoreMapped(text, options, 0, false).text;
}

function newLatinCore(text: string, options: ConversionOptions): string {
  const { text: source } = applyExceptions({ text: prepareText(text), origins: null }, options);
  let output = '';
  for (let index = 0; index < source.length; index += 1) {
    const character = source[index]!;
    const lower = lowerChar(character);
    const replacement =
      lower === 'ö'
        ? 'oʻ'
        : lower === 'ğ'
          ? 'gʻ'
          : lower === 'ş'
            ? 'sh'
            : lower === 'ç'
              ? 'ch'
              : undefined;
    const inUppercaseWord =
      isUpper(character) && (isUpper(source[index + 1] ?? '') || isUpper(source[index - 1] ?? ''));
    output +=
      replacement === undefined
        ? character
        : inUppercaseWord
          ? upperText(replacement)
          : firstCase(character, replacement);
  }
  return output.normalize('NFC');
}

/** Previous Latin to new Latin across protected spans, with offsets into `text`. */
export function toNewLatinMapped(
  text: string,
  options: ConversionOptions = {},
): { text: string; origins: number[] } {
  return mapSegmentsMapped(text, options, (segment, start) =>
    oldLatinCoreMapped(segment, options, start),
  );
}

/** Convert previous Uzbek Latin text to the new Latin alphabet. */
export function toNewLatin(text: string, options: ConversionOptions = {}): ConversionResult {
  return mapSegments(text, options, (segment) => ({
    text: oldLatinCore(segment, options),
    warnings: [],
  }));
}

/** Convert new Uzbek Latin text to the previous Latin alphabet. */
export function toOldLatin(text: string, options: ConversionOptions = {}): ConversionResult {
  return mapSegments(text, options, (segment) => ({
    text: newLatinCore(segment, options),
    warnings: [],
  }));
}
