import { firstCase, lowerChar } from './case.js';
import { oldLatinCore, toNewLatin } from './latin.js';
import { prepareText } from './normalize.js';
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

function warning(
  index: number,
  rule: string,
  message: string,
  alternatives: string[],
  length = 1,
): Warning {
  return { index, length, rule, message, alternatives };
}

function fromCyrillicCore(
  text: string,
  offset: number,
  options: ConversionOptions,
): ConversionResult {
  const source = applyExceptions(prepareText(text), options);
  let output = '';
  const warnings: Warning[] = [];
  let previousLetter = '';

  for (let index = 0; index < source.length; index += 1) {
    const character = source[index]!;
    const lower = lowerChar(character);
    const uppercase = character !== lower;
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
          offset + index,
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
          offset + index,
          'cyrillic.tse.positional',
          'Cyrillic ц can represent s or ts; a positional rule was applied.',
          ['s', 'ts'],
        ),
      );
    } else if (lower === 'щ') {
      replacement = 'şç';
      warnings.push(
        warning(
          offset + index,
          'cyrillic.shcha.ambiguous',
          'Cyrillic щ has no single new-Latin equivalent; şç was chosen.',
          ['şç', 'ş'],
        ),
      );
    } else if (lower === 'ъ') {
      replacement = 'ʼ';
      warnings.push(
        warning(
          offset + index,
          'cyrillic.hard-sign.ambiguous',
          'The hard sign was retained as tutuq belgisi.',
          ['ʼ', ''],
        ),
      );
    } else if (lower === 'ь') {
      replacement = '';
      warnings.push(
        warning(offset + index, 'cyrillic.soft-sign.ambiguous', 'The soft sign was dropped.', [
          '',
          'ʼ',
        ]),
      );
    } else if (lower === 'ё' || lower === 'ю' || lower === 'я') {
      replacement = lower === 'ё' ? 'yo' : lower === 'ю' ? 'yu' : 'ya';
      const name = lower === 'ё' ? 'yo' : lower === 'ю' ? 'yu' : 'ya';
      warnings.push(
        warning(
          offset + index,
          `cyrillic.${name}.compound`,
          `Cyrillic ${lower} was expanded to ${name}.`,
          [name, name.slice(1)],
        ),
      );
    } else {
      replacement = DIRECT_FROM_CYRILLIC[lower];
    }

    output +=
      replacement === undefined
        ? character
        : uppercase
          ? firstCase(character, replacement)
          : replacement;
    if (/\p{L}/u.test(character)) previousLetter = lower;
    else previousLetter = '';
  }
  return { text: oldLatinCore(output, options).normalize('NFC'), warnings };
}

export function fromCyrillic(text: string, options: ConversionOptions = {}): ConversionResult {
  return mapSegments(text, options, (segment, start) => fromCyrillicCore(segment, start, options));
}

function toCyrillicCore(text: string, offset: number): ConversionResult {
  const source = prepareText(text);
  let output = '';
  const warnings: Warning[] = [];
  let index = 0;
  while (index < source.length) {
    const character = source[index]!;
    const lower = lowerChar(character);
    const uppercase = character !== lower;
    const pair = lower + lowerChar(source[index + 1] ?? '');
    let replacement: string | undefined;
    let consumed = 1;

    if (pair === 'şç') {
      replacement = 'щ';
      consumed = 2;
      warnings.push(
        warning(
          offset + index,
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
          offset + index,
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
        warning(
          offset + index,
          'latin.tse.ambiguous',
          'ts was interpreted as Cyrillic ц.',
          ['ц', 'тс'],
          2,
        ),
      );
    } else if (lower === 'e') {
      replacement = 'е';
      warnings.push(
        warning(
          offset + index,
          'latin.e.ambiguous',
          'Latin e can correspond to Cyrillic е or э; е was chosen.',
          ['е', 'э'],
        ),
      );
    } else if (character === 'ʼ') {
      replacement = 'ъ';
      warnings.push(
        warning(
          offset + index,
          'latin.tutuq.ambiguous',
          'Tutuq belgisi was interpreted as a hard sign.',
          ['ъ', 'ь', ''],
        ),
      );
    } else if (lower === 'c') {
      replacement = 'ц';
      warnings.push(
        warning(
          offset + index,
          'latin.c.ambiguous',
          'Standalone c was interpreted as Cyrillic ц.',
          ['ц', 'с'],
        ),
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
  return { text: output.normalize('NFC'), warnings };
}

export function toCyrillic(text: string, options: ConversionOptions = {}): ConversionResult {
  const canonical = toNewLatin(text, options).text;
  return mapSegments(canonical, options, (segment, start) => toCyrillicCore(segment, start));
}
