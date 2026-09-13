import seedExceptions from './data/exceptions.json';
import seedProtectedTerms from './data/protected-terms.json';
import type { MappedText } from './normalize.js';
import type { ConversionOptions, Warning } from './types.js';

interface Span {
  start: number;
  end: number;
}

export interface Segment {
  text: string;
  start: number;
  protected: boolean;
}

function collectMatches(text: string, expression: RegExp, spans: Span[]): void {
  for (const match of text.matchAll(expression)) {
    if (match.index !== undefined)
      spans.push({ start: match.index, end: match.index + match[0].length });
  }
}

export function splitProtected(text: string, options: ConversionOptions = {}): Segment[] {
  if (options.protectSpans === false) return [{ text, start: 0, protected: false }];

  const spans: Span[] = [];
  collectMatches(text, /`[^`\n]*`/gu, spans);
  collectMatches(text, /[\p{L}\p{N}._%+-]+@[\p{L}\p{N}.-]+\.[\p{L}]{2,}/gu, spans);
  collectMatches(text, /(?:https?:\/\/|www\.)[^\s`]+/gu, spans);

  for (const term of [...seedProtectedTerms, ...(options.protectedTerms ?? [])]) {
    if (term.length === 0) continue;
    let start = text.indexOf(term);
    while (start >= 0) {
      spans.push({ start, end: start + term.length });
      start = text.indexOf(term, start + term.length);
    }
  }

  spans.sort(
    (left, right) => left.start - right.start || right.end - right.start - (left.end - left.start),
  );
  const selected: Span[] = [];
  for (const span of spans) {
    const previous = selected[selected.length - 1];
    if (previous === undefined || span.start >= previous.end) selected.push(span);
  }

  const segments: Segment[] = [];
  let cursor = 0;
  for (const span of selected) {
    if (span.start > cursor)
      segments.push({ text: text.slice(cursor, span.start), start: cursor, protected: false });
    segments.push({ text: text.slice(span.start, span.end), start: span.start, protected: true });
    cursor = span.end;
  }
  if (cursor < text.length)
    segments.push({ text: text.slice(cursor), start: cursor, protected: false });
  return segments.length > 0 ? segments : [{ text, start: 0, protected: false }];
}

const WORD_CHARACTER = /^[\p{L}\p{N}\p{M}]$/u;

/** Whether the code point ending just before `index` is a letter, number or mark. */
function isWordBefore(text: string, index: number): boolean {
  if (index <= 0) return false;
  const low = text.charCodeAt(index - 1);
  const start = low >= 0xdc00 && low <= 0xdfff && index >= 2 ? index - 2 : index - 1;
  return WORD_CHARACTER.test(String.fromCodePoint(text.codePointAt(start)!));
}

/** Whether the code point starting at `index` is a letter, number or mark. */
function isWordAt(text: string, index: number): boolean {
  if (index >= text.length) return false;
  return WORD_CHARACTER.test(String.fromCodePoint(text.codePointAt(index)!));
}

export function applyExceptions(source: MappedText, options: ConversionOptions): MappedText {
  const { text, origins } = source;
  const entries = Object.entries({ ...seedExceptions, ...(options.exceptions ?? {}) })
    .filter(([key]) => key.length > 0)
    .sort(([left], [right]) => right.length - left.length);
  let result = '';
  const resultOrigins: number[] = [];
  let cursor = 0;
  while (cursor < text.length) {
    let replacement: { key: string; value: string } | undefined;
    for (const [key, value] of entries) {
      if (
        text.startsWith(key, cursor) &&
        !isWordBefore(text, cursor) &&
        !isWordAt(text, cursor + key.length)
      ) {
        replacement = { key, value };
        break;
      }
    }
    if (replacement !== undefined) {
      result += replacement.value;
      for (let unit = 0; unit < replacement.value.length; unit += 1) {
        resultOrigins.push(origins[cursor]!);
      }
      cursor += replacement.key.length;
    } else {
      result += text[cursor];
      resultOrigins.push(origins[cursor]!);
      cursor += 1;
    }
  }
  resultOrigins.push(origins[text.length]!);
  return { text: result, origins: resultOrigins };
}

export function mapSegments(
  text: string,
  options: ConversionOptions,
  convert: (text: string, start: number) => { text: string; warnings: Warning[] },
): { text: string; warnings: Warning[] } {
  let output = '';
  const warnings: Warning[] = [];
  for (const segment of splitProtected(text, options)) {
    if (segment.protected) {
      output += segment.text;
    } else {
      const converted = convert(segment.text, segment.start);
      output += converted.text;
      for (const warning of converted.warnings) warnings.push(warning);
    }
  }
  return { text: output, warnings };
}

/** Like `mapSegments`, but for converters that report where each output unit came from. */
export function mapSegmentsMapped(
  text: string,
  options: ConversionOptions,
  convert: (text: string, start: number) => MappedText,
): MappedText {
  let output = '';
  const origins: number[] = [];
  for (const segment of splitProtected(text, options)) {
    const converted = segment.protected
      ? {
          text: segment.text,
          origins: Array.from(
            { length: segment.text.length + 1 },
            (_, index) => segment.start + index,
          ),
        }
      : convert(segment.text, segment.start);
    output += converted.text;
    // A loop rather than push(...spread), which overflows the stack on long documents.
    for (let unit = 0; unit < converted.text.length; unit += 1) {
      origins.push(converted.origins[unit]!);
    }
  }
  origins.push(text.length);
  return { text: output, origins };
}
