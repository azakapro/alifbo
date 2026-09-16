import { firstCase, isUpper, lowerChar, upperText } from './case.js';
import { oldLatinCore, toNewLatinMapped } from './latin.js';
import { normalizeConfusables, prepareTextMapped, sourceRange } from './normalize.js';
import { applyExceptions, mapSegments, splitProtected } from './pipeline.js';
import type { ConversionOptions, ConversionResult, Warning } from './types.js';

const DIRECT_FROM_CYRILLIC: Readonly<Record<string, string>> = {
  а: 'a',
  б: 'b',
  в: 'v',
  г: 'g',
  д: 'd',
  ж: 'j',
  з: 'z',
  и: 'i',
  й: 'y',
  к: 'k',
  л: 'l',
  м: 'm',
  н: 'n',
  о: 'o',
  п: 'p',
  р: 'r',
  с: 's',
  т: 't',
  у: 'u',
  ф: 'f',
  х: 'x',
  ч: 'ç',
  ш: 'ş',
  ы: 'i',
  э: 'e',
  ў: 'ö',
  қ: 'q',
  ғ: 'ğ',
  ҳ: 'h',
};

const DIRECT_TO_CYRILLIC: Readonly<Record<string, string>> = {
  a: 'а',
  b: 'б',
  v: 'в',
  g: 'г',
  d: 'д',
  j: 'ж',
  z: 'з',
  i: 'и',
  y: 'й',
  k: 'к',
  l: 'л',
  m: 'м',
  n: 'н',
  o: 'о',
  p: 'п',
  r: 'р',
  s: 'с',
  t: 'т',
  u: 'у',
  f: 'ф',
  x: 'х',
  ç: 'ч',
  ş: 'ш',
  ö: 'ў',
  q: 'қ',
  ğ: 'ғ',
  h: 'ҳ',
};

const CYRILLIC_VOWELS = new Set(['а', 'е', 'ё', 'и', 'о', 'у', 'ў', 'э', 'ю', 'я']);

const LATIN_VOWELS = new Set(['a', 'e', 'i', 'o', 'u', 'ö']);
// Vowels after which ь becomes a written y; iotated vowels (ё ю я е) already supply it.
const SOFT_SIGN_GLIDE_VOWELS = new Set(['а', 'о', 'у', 'э', 'ў']);

function warning(
  index: number,
  rule: string,
  message: string,
  alternatives: string[],
  length = 1,
): Warning {
  return { index, length, rule, message, alternatives };
}

/** Rewrite warning ranges from prepared-text offsets to offsets in the caller's text. */
function toSourceOffsets(
  warnings: Warning[],
  origins: readonly number[] | null,
  offset: number,
): void {
  for (const item of warnings) {
    const range = sourceRange(origins, item.index, item.length);
    item.index = offset + range.index;
    item.length = range.length;
  }
}

function isLatinLetter(character: string): boolean {
  return (
    /^\p{L}$/u.test(character) &&
    /^[A-Za-z\u00c0-\u024f\u1e00-\u1eff]/u.test(character.normalize('NFKC'))
  );
}

/** The lowercased letter at `index` for positional rules, or '' when it is not a letter. */
function letterAt(source: string, index: number): string {
  if (index < 0 || index >= source.length) return '';
  const unit = source.charCodeAt(index);
  const before = index > 0 ? source.charCodeAt(index - 1) : 0;
  if (unit >= 0xdc00 && unit <= 0xdfff && before >= 0xd800 && before <= 0xdbff) {
    return letterAt(source, index - 1);
  }
  const codePoint = String.fromCodePoint(source.codePointAt(index)!);
  return /\p{L}/u.test(codePoint) ? lowerChar(codePoint) : '';
}

/** Case a multi-letter replacement: all caps inside an uppercase word, else title case. */
function caseReplacement(source: string, index: number, lower: string): string {
  const character = source[index]!;
  if (!isUpper(character)) return lower;
  const inUppercaseWord =
    isUpper(source[index + 1] ?? '') || (index > 0 && isUpper(source[index - 1]!));
  return inUppercaseWord ? upperText(lower) : firstCase(character, lower);
}

function fromCyrillicCore(
  text: string,
  offset: number,
  options: ConversionOptions,
): ConversionResult {
  const { text: source, origins } = applyExceptions(prepareTextMapped(text), options);
  let output = '';
  const warnings: Warning[] = [];
  let previousLetter = '';

  for (let index = 0; index < source.length; index += 1) {
    const character = source[index]!;
    const lower = lowerChar(character);
    let replacement: string | undefined;

    if (lower === 'е') {
      const useYe =
        previousLetter === '' ||
        CYRILLIC_VOWELS.has(previousLetter) ||
        previousLetter === 'ъ' ||
        previousLetter === 'ь';
      replacement = useYe ? 'ye' : 'e';
      warnings.push(
        warning(
          index,
          'cyrillic.e.positional',
          'Cyrillic е can represent e or ye; a positional rule was applied.',
          ['e', 'ye'],
        ),
      );
    } else if (lower === 'ц') {
      const useS = previousLetter === '' || previousLetter === 'ц';
      replacement = useS ? 's' : 'ts';
      warnings.push(
        warning(
          index,
          'cyrillic.tse.positional',
          'Cyrillic ц can represent s or ts; a positional rule was applied.',
          ['s', 'ts'],
        ),
      );
    } else if (lower === 'щ') {
      replacement = 'şç';
      warnings.push(
        warning(
          index,
          'cyrillic.shcha.ambiguous',
          'Cyrillic щ has no single new-Latin equivalent; şç was chosen.',
          ['şç', 'ş'],
        ),
      );
    } else if (lower === 'ъ') {
      replacement = 'ʼ';
      warnings.push(
        warning(
          index,
          'cyrillic.hard-sign.ambiguous',
          'The hard sign was retained as tutuq belgisi.',
          ['ʼ', ''],
        ),
      );
    } else if (lower === 'ь') {
      // Before a plain vowel the soft sign marks a glide (батальон → batalyon); elsewhere it
      // has no Latin counterpart and is dropped (медаль → medal).
      const glide = SOFT_SIGN_GLIDE_VOWELS.has(letterAt(source, index + 1));
      replacement = glide ? 'y' : '';
      warnings.push(
        warning(
          index,
          'cyrillic.soft-sign.ambiguous',
          glide ? 'The soft sign before a vowel was written as y.' : 'The soft sign was dropped.',
          glide ? ['y', ''] : ['', 'ʼ'],
        ),
      );
    } else if (lower === 'ё' || lower === 'ю' || lower === 'я') {
      replacement = lower === 'ё' ? 'yo' : lower === 'ю' ? 'yu' : 'ya';
      const name = lower === 'ё' ? 'yo' : lower === 'ю' ? 'yu' : 'ya';
      warnings.push(
        warning(index, `cyrillic.${name}.compound`, `Cyrillic ${lower} was expanded to ${name}.`, [
          name,
          name.slice(1),
        ]),
      );
    } else {
      replacement = DIRECT_FROM_CYRILLIC[lower];
    }

    output += replacement === undefined ? character : caseReplacement(source, index, replacement);
    previousLetter = letterAt(source, index);
  }
  toSourceOffsets(warnings, origins, offset);
  return { text: oldLatinCore(output, options).normalize('NFC'), warnings };
}

/** Convert Uzbek Cyrillic to new Latin and report every lossy or ambiguous choice. */
export function fromCyrillic(text: string, options: ConversionOptions = {}): ConversionResult {
  return mapSegments(text, options, (segment, start) => fromCyrillicCore(segment, start, options));
}

/** Lowercase letters of the 2026 Latin alphabet. Any other Latin letter marks a foreign word. */
const UZBEK_LATIN_LETTERS = new Set([...'abdefghijklmnopqrstuvxyzöğşç']);

// What continues a word in the foreign-word scan: letters, marks, digits, hyphens and every
// apostrophe-like character, so `Wi-Fi`, `oʻzbek`, `o'zbek` and `McDonald's` are single words.
const WORD_PART = /^[\p{L}\p{M}\p{N}ʻʼ'‘’`´′＇-]$/u;

/**
 * A word is foreign when it has a Latin letter outside the Uzbek alphabet (`w`, `ü`, a `c`
 * that is not part of the previous alphabet's `ch`) or a capital after a lowercase letter
 * (`iPhone`, `SiO2`). Uzbek words never do either, so converting such a word letter by
 * letter would only produce a mix of two alphabets. Astral letters are skipped for parity
 * with the Python port.
 */
function isForeignWord(word: string): boolean {
  const characters = [...normalizeConfusables(word)];
  let afterLowercase = false;
  for (let at = 0; at < characters.length; at += 1) {
    const character = characters[at]!;
    if (character.length > 1 || !isLatinLetter(character)) {
      afterLowercase = false;
      continue;
    }
    const lower = lowerChar(character);
    const digraph = lower === 'c' && lowerChar(characters[at + 1] ?? '') === 'h';
    if (!digraph && !UZBEK_LATIN_LETTERS.has(lower)) return true;
    if (isUpper(character) && afterLowercase) return true;
    afterLowercase = character !== upperText(character);
  }
  return false;
}

interface Piece {
  text: string;
  start: number;
  foreign: boolean;
}

/** Cut `text` (unprotected, starting at `start` in the caller's text) around foreign words. */
function splitForeignWords(text: string, start: number): Piece[] {
  const pieces: Piece[] = [];
  let cursor = 0;
  let index = 0;
  while (index < text.length) {
    const character = String.fromCodePoint(text.codePointAt(index)!);
    if (!WORD_PART.test(character)) {
      index += character.length;
      continue;
    }
    let end = index;
    while (end < text.length) {
      const part = String.fromCodePoint(text.codePointAt(end)!);
      if (!WORD_PART.test(part)) break;
      end += part.length;
    }
    const word = text.slice(index, end);
    if (isForeignWord(word)) {
      if (index > cursor)
        pieces.push({ text: text.slice(cursor, index), start: start + cursor, foreign: false });
      pieces.push({ text: word, start: start + index, foreign: true });
      cursor = end;
    }
    index = end;
  }
  if (cursor < text.length)
    pieces.push({ text: text.slice(cursor), start: start + cursor, foreign: false });
  return pieces;
}

/** Convert the letters at `index` and report the choice; returns the output piece and units read. */
function convertAt(
  source: string,
  index: number,
  warnings: Warning[],
): { piece: string; consumed: number } {
  const character = source[index]!;
  const lower = lowerChar(character);
  const uppercase = character !== lower;
  const pair = lower + lowerChar(source[index + 1] ?? '');
  // Inverse of the fromCyrillic е rule: Cyrillic е is read "ye" at a word start, after
  // a vowel, or after ъ/ь, so there "ye" maps back to е and a bare "e" must be э.
  const previous = index > 0 ? letterAt(source, index - 1) : '';
  const positional = previous === '' || previous === 'ʼ' || LATIN_VOWELS.has(previous);
  let replacement: string | undefined;
  let consumed = 1;

  if (pair === 'şç') {
    replacement = 'щ';
    consumed = 2;
    warnings.push(
      warning(
        index,
        'latin.shcha.ambiguous',
        'şç was interpreted as Cyrillic щ rather than шч.',
        ['щ', 'шч'],
        2,
      ),
    );
  } else if (pair === 'yo' || pair === 'yu' || pair === 'ya') {
    replacement = pair === 'yo' ? 'ё' : pair === 'yu' ? 'ю' : 'я';
    consumed = 2;
    warnings.push(
      warning(
        index,
        `latin.${pair}.ambiguous`,
        `${pair} was interpreted as one iotated Cyrillic letter.`,
        [replacement, `й${DIRECT_TO_CYRILLIC[pair[1]!]}`],
        2,
      ),
    );
  } else if (pair === 'ts') {
    replacement = 'ц';
    consumed = 2;
    warnings.push(
      warning(index, 'latin.tse.ambiguous', 'ts was interpreted as Cyrillic ц.', ['ц', 'тс'], 2),
    );
  } else if (pair === 'ye' && positional) {
    replacement = 'е';
    consumed = 2;
    warnings.push(
      warning(
        index,
        'latin.ye.positional',
        'ye at a word start, after a vowel, or after tutuq was interpreted as Cyrillic е.',
        ['е', 'йе'],
        2,
      ),
    );
  } else if (lower === 'e') {
    replacement = positional ? 'э' : 'е';
    warnings.push(
      warning(
        index,
        'latin.e.ambiguous',
        `Latin e can correspond to Cyrillic е or э; ${replacement} was chosen.`,
        positional ? ['э', 'е'] : ['е', 'э'],
      ),
    );
  } else if (character === 'ʼ') {
    replacement = 'ъ';
    warnings.push(
      warning(index, 'latin.tutuq.ambiguous', 'Tutuq belgisi was interpreted as a hard sign.', [
        'ъ',
        'ь',
        '',
      ]),
    );
  } else if (lower === 'c') {
    replacement = 'ц';
    warnings.push(
      warning(index, 'latin.c.ambiguous', 'Standalone c was interpreted as Cyrillic ц.', [
        'ц',
        'с',
      ]),
    );
  } else {
    replacement = DIRECT_TO_CYRILLIC[lower];
    if (replacement === undefined && (isLatinLetter(character) || character === 'ʻ')) {
      warnings.push(
        warning(
          index,
          'latin.unmapped',
          character === 'ʻ'
            ? 'Stray ʻ is not part of oʻ or gʻ and has no Cyrillic mapping.'
            : `Latin ${character} has no Cyrillic mapping.`,
          [],
        ),
      );
    }
  }

  const piece =
    replacement === undefined
      ? character
      : uppercase
        ? firstCase(character, replacement)
        : replacement;
  return { piece, consumed };
}

function toCyrillicCore(text: string, offset: number): ConversionResult {
  const { text: source, origins } = prepareTextMapped(text);
  let output = '';
  const warnings: Warning[] = [];
  let index = 0;
  while (index < source.length) {
    const step = convertAt(source, index, warnings);
    output += step.piece;
    index += step.consumed;
  }
  toSourceOffsets(warnings, origins, offset);
  return { text: output.normalize('NFC'), warnings };
}

/** Latin → Cyrillic for one span with no foreign words; warning offsets are shifted by `start`. */
function latinToCyrillic(text: string, options: ConversionOptions, start = 0): ConversionResult {
  const canonical = toNewLatinMapped(text, options);
  const result = mapSegments(canonical.text, options, (segment, offset) =>
    toCyrillicCore(segment, offset),
  );
  // Warnings point into the new-Latin intermediate; report them against the caller's text.
  toSourceOffsets(result.warnings, canonical.origins, start);
  return result;
}

/**
 * Convert new (or previous) Uzbek Latin to Cyrillic and report every lossy or ambiguous choice.
 * Words the Uzbek alphabet cannot spell (`Windows`, `Microsoft`, `iPhone`) are kept as written
 * and reported as `latin.foreign` unless `foreignWords` is `'transliterate'`.
 */
export function toCyrillic(text: string, options: ConversionOptions = {}): ConversionResult {
  const keepForeign = options.foreignWords !== 'transliterate';
  let output = '';
  const warnings: Warning[] = [];
  for (const segment of splitProtected(text, options)) {
    if (segment.protected) {
      output += segment.text;
      continue;
    }
    const pieces = keepForeign
      ? splitForeignWords(segment.text, segment.start)
      : [{ text: segment.text, start: segment.start, foreign: false }];
    for (const piece of pieces) {
      if (piece.foreign) {
        output += piece.text;
        warnings.push(
          warning(
            piece.start,
            'latin.foreign',
            `${piece.text} looks foreign (non-Uzbek letters or mixed case) and was left unchanged.`,
            [piece.text, latinToCyrillic(piece.text, options).text],
            piece.text.length,
          ),
        );
        continue;
      }
      const converted = latinToCyrillic(piece.text, options, piece.start);
      output += converted.text;
      for (const item of converted.warnings) warnings.push(item);
    }
  }
  return { text: output, warnings };
}
