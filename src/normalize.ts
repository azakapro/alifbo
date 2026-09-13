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

/**
 * Text paired with the source offset of each UTF-16 code unit. `origins` has one extra
 * trailing entry holding the source end, so `origins[index + length]` is always defined.
 */
export interface MappedText {
  text: string;
  origins: number[];
}

export function identityMapped(text: string, offset = 0): MappedText {
  return { text, origins: Array.from({ length: text.length + 1 }, (_, index) => offset + index) };
}

/** Translate a range in mapped text back to a range in the source text. */
export function sourceRange(
  origins: readonly number[],
  index: number,
  length: number,
): { index: number; length: number } {
  const start = origins[index] ?? origins[origins.length - 1]!;
  const end = origins[index + length] ?? origins[origins.length - 1]!;
  return { index: start, length: Math.max(end - start, length > 0 ? 1 : 0) };
}

// A normalization chunk starts at a code point that cannot compose with what precedes it:
// anything except combining marks and Hangul medial/final jamo.
const CONTINUES_CHUNK = /^[\p{M}\u1160-\u11FF\uD7B0-\uD7FF]$/u;

/** NFC-normalize while recording, for each output code unit, the source offset it came from. */
function nfcMapped(text: string): MappedText {
  const whole = text.normalize('NFC');
  let output = '';
  const origins: number[] = [];
  let chunkStart = 0;
  let index = 0;
  const flush = (end: number) => {
    if (end === chunkStart) return;
    const normalized = text.slice(chunkStart, end).normalize('NFC');
    output += normalized;
    for (let unit = 0; unit < normalized.length; unit += 1) origins.push(chunkStart);
    chunkStart = end;
  };
  while (index < text.length) {
    const codePoint = String.fromCodePoint(text.codePointAt(index)!);
    if (index > 0 && !CONTINUES_CHUNK.test(codePoint)) flush(index);
    index += codePoint.length;
  }
  flush(text.length);
  origins.push(text.length);
  // Chunked normalization equals whole-string NFC for all realistic input; if a rare
  // cross-chunk composition occurs, keep the exact text and fall back to clamped offsets.
  if (output !== whole) {
    return {
      text: whole,
      origins: Array.from({ length: whole.length + 1 }, (_, unit) => Math.min(unit, text.length)),
    };
  }
  return { text: output, origins };
}

/** `prepareText` with source offsets. Confusable and apostrophe folding are one-to-one. */
export function prepareTextMapped(text: string): MappedText {
  const normalized = nfcMapped(text);
  const prepared = prepareText(text);
  if (prepared.length !== normalized.text.length) {
    return {
      text: prepared,
      origins: Array.from({ length: prepared.length + 1 }, (_, unit) =>
        Math.min(unit, text.length),
      ),
    };
  }
  return { text: prepared, origins: normalized.origins };
}
