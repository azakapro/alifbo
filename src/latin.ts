import { firstCase, isUpper, lowerChar, upperText } from './case.js';
import { applyExceptions, mapSegments } from './pipeline.js';
import { prepareText } from './normalize.js';
import type { ConversionOptions, ConversionResult } from './types.js';

// TODO(ng): Change only this value if the authoritative law assigns a new single letter.
const NG_DIGRAPH_OUTPUT = 'ng';

function isPairAt(text: string, index: number, first: string, second: string): boolean {
  return lowerChar(text[index] ?? '') === first && lowerChar(text[index + 1] ?? '') === second;
}

export function oldLatinCore(text: string, options: ConversionOptions = {}): string {
  const source = applyExceptions(prepareText(text), options);
  let output = '';
  let index = 0;
  while (index < source.length) {
    const character = source[index]!;
    const next = source[index + 1];

    if ((lowerChar(character) === 'o' || lowerChar(character) === 'g') && next === 'ʻ') {
      output += firstCase(character, lowerChar(character) === 'o' ? 'ö' : 'ğ');
      index += 2;
      continue;
    }
    if (
      lowerChar(character) === 's' &&
      next === 'ʼ' &&
      lowerChar(source[index + 2] ?? '') === 'h'
    ) {
      output += character + next + source[index + 2];
      index += 3;
      continue;
    }
    if (isPairAt(source, index, 's', 'h')) {
      output += firstCase(character, 'ş');
      index += 2;
      continue;
    }
    if (isPairAt(source, index, 'c', 'h')) {
      output += firstCase(character, 'ç');
      index += 2;
      continue;
    }
    if (options.ngAsDigraph !== false && isPairAt(source, index, 'n', 'g')) {
      output +=
        NG_DIGRAPH_OUTPUT === 'ng'
          ? source.slice(index, index + 2)
          : firstCase(character, NG_DIGRAPH_OUTPUT);
      index += 2;
      continue;
    }
    output += character;
    index += 1;
  }
  return output.normalize('NFC');
}

function newLatinCore(text: string, options: ConversionOptions): string {
  const source = applyExceptions(prepareText(text), options);
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
    output +=
      replacement === undefined
        ? character
        : isUpper(character) && isUpper(source[index + 1] ?? '')
          ? upperText(replacement)
          : firstCase(character, replacement);
  }
  return output.normalize('NFC');
}

export function toNewLatin(text: string, options: ConversionOptions = {}): ConversionResult {
  return mapSegments(text, options, (segment) => ({
    text: oldLatinCore(segment, options),
    warnings: [],
  }));
}

export function toOldLatin(text: string, options: ConversionOptions = {}): ConversionResult {
  return mapSegments(text, options, (segment) => ({
    text: newLatinCore(segment, options),
    warnings: [],
  }));
}
