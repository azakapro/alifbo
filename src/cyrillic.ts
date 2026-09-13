import { firstCase, isUpper, lowerChar, upperText } from './case.js';
import { oldLatinCore, toNewLatinMapped } from './latin.js';
import { prepareTextMapped, sourceRange } from './normalize.js';
import { applyExceptions, mapSegments } from './pipeline.js';
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

/** The lowercased letter at `index` for positional rules, or '' when it is not a letter. */
function letterAt(source: string, index: number): string {
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
      replacement = '';
      warnings.push(
        warning(index, 'cyrillic.soft-sign.ambiguous', 'The soft sign was dropped.', ['', 'ʼ']),
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

function toCyrillicCore(text: string, offset: number): ConversionResult {
  const { text: source, origins } = prepareTextMapped(text);
  let output = '';
  const warnings: Warning[] = [];
  let index = 0;
  while (index < source.length) {
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
    }

    output +=
      replacement === undefined
        ? character
        : uppercase
          ? firstCase(character, replacement)
          : replacement;
    index += consumed;
  }
  toSourceOffsets(warnings, origins, offset);
  return { text: output.normalize('NFC'), warnings };
}

/** Convert new Uzbek Latin to Cyrillic and report every lossy or ambiguous choice. */
export function toCyrillic(text: string, options: ConversionOptions = {}): ConversionResult {
  const canonical = toNewLatinMapped(text, options);
  const result = mapSegments(canonical.text, options, (segment, start) =>
    toCyrillicCore(segment, start),
  );
  // Warnings point into the new-Latin intermediate; report them against the caller's text.
  toSourceOffsets(result.warnings, canonical.origins, 0);
  return result;
}
