const APOSTROPHE_LIKE = new Set(['ʻ', 'ʼ', "'", '‘', '’', '`', '´', '′', '＇']);
const LETTER_MODIFIER_PREDECESSORS = new Set(['o', 'O', 'g', 'G']);
const CONFUSABLES: Readonly<Record<string, string>> = { ș: 'ş', Ș: 'Ş' };

/** NFC-normalize text and fold known visual confusables to their canonical Uzbek forms. */
export function normalizeConfusables(text: string): string {
  let result = '';
  for (const character of text.normalize('NFC')) result += CONFUSABLES[character] ?? character;
  return result.normalize('NFC');
}

/** Collapse supported apostrophe-like characters to U+02BB after o/g and U+02BC elsewhere. */
export function normalizeApostrophes(text: string): string {
  const source = normalizeConfusables(text);
  let result = '';
  let previous = '';
  for (const character of source) {
    const normalized = APOSTROPHE_LIKE.has(character)
      ? LETTER_MODIFIER_PREDECESSORS.has(previous)
        ? 'ʻ'
        : 'ʼ'
      : character;
    result += normalized;
    previous = character;
  }
  return result.normalize('NFC');
}

export function prepareText(text: string): string {
  return normalizeApostrophes(normalizeConfusables(text.normalize('NFC')));
}
