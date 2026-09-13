const CASE_PAIRS = [
  ['a', 'A'],
  ['b', 'B'],
  ['c', 'C'],
  ['d', 'D'],
  ['e', 'E'],
  ['f', 'F'],
  ['g', 'G'],
  ['h', 'H'],
  ['i', 'I'],
  ['j', 'J'],
  ['k', 'K'],
  ['l', 'L'],
  ['m', 'M'],
  ['n', 'N'],
  ['o', 'O'],
  ['p', 'P'],
  ['q', 'Q'],
  ['r', 'R'],
  ['s', 'S'],
  ['t', 'T'],
  ['u', 'U'],
  ['v', 'V'],
  ['w', 'W'],
  ['x', 'X'],
  ['y', 'Y'],
  ['z', 'Z'],
  ['ö', 'Ö'],
  ['ğ', 'Ğ'],
  ['ş', 'Ş'],
  ['ç', 'Ç'],
  ['ș', 'Ș'],
  ['а', 'А'],
  ['б', 'Б'],
  ['в', 'В'],
  ['г', 'Г'],
  ['д', 'Д'],
  ['е', 'Е'],
  ['ё', 'Ё'],
  ['ж', 'Ж'],
  ['з', 'З'],
  ['и', 'И'],
  ['й', 'Й'],
  ['к', 'К'],
  ['л', 'Л'],
  ['м', 'М'],
  ['н', 'Н'],
  ['о', 'О'],
  ['п', 'П'],
  ['р', 'Р'],
  ['с', 'С'],
  ['т', 'Т'],
  ['у', 'У'],
  ['ф', 'Ф'],
  ['х', 'Х'],
  ['ц', 'Ц'],
  ['ч', 'Ч'],
  ['ш', 'Ш'],
  ['щ', 'Щ'],
  ['ъ', 'Ъ'],
  ['ы', 'Ы'],
  ['ь', 'Ь'],
  ['э', 'Э'],
  ['ю', 'Ю'],
  ['я', 'Я'],
  ['ў', 'Ў'],
  ['қ', 'Қ'],
  ['ғ', 'Ғ'],
  ['ҳ', 'Ҳ'],
] as const;

const LOWER_TO_UPPER: Readonly<Record<string, string>> = Object.fromEntries(CASE_PAIRS);
const UPPER_TO_LOWER: Readonly<Record<string, string>> = Object.fromEntries(
  CASE_PAIRS.map(([lower, upper]) => [upper, lower]),
);

export function lowerChar(character: string): string {
  return UPPER_TO_LOWER[character] ?? character;
}

export function upperChar(character: string): string {
  return LOWER_TO_UPPER[character] ?? character;
}

export function lowerText(text: string): string {
  let result = '';
  for (const character of text) result += lowerChar(character);
  return result;
}

export function upperText(text: string): string {
  let result = '';
  for (const character of text) result += upperChar(character);
  return result;
}

export function isUpper(character: string): boolean {
  return UPPER_TO_LOWER[character] !== undefined;
}

export function firstCase(source: string, lowerOutput: string): string {
  if (!isUpper(source) || lowerOutput.length === 0) return lowerOutput;
  return upperChar(lowerOutput[0]!) + lowerOutput.slice(1);
}
