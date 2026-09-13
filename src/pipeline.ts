import seedExceptions from './data/exceptions.json';
import seedProtectedTerms from './data/protected-terms.json';
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

function isWordCharacter(character: string | undefined): boolean {
  return character !== undefined && /[\p{L}\p{N}\p{M}]/u.test(character);
}

export function applyExceptions(text: string, options: ConversionOptions): string {
  const entries = Object.entries({ ...seedExceptions, ...(options.exceptions ?? {}) }).sort(
    ([left], [right]) => right.length - left.length,
  );
  let result = '';
  let cursor = 0;
  while (cursor < text.length) {
    let replacement: { key: string; value: string } | undefined;
    for (const [key, value] of entries) {
      if (
        text.startsWith(key, cursor) &&
        !isWordCharacter(text[cursor - 1]) &&
        !isWordCharacter(text[cursor + key.length])
      ) {
        replacement = { key, value };
        break;
      }
    }
    if (replacement !== undefined) {
      result += replacement.value;
      cursor += replacement.key.length;
    } else {
      result += text[cursor];
      cursor += 1;
    }
  }
  return result;
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
      warnings.push(...converted.warnings);
    }
  }
  return { text: output, warnings };
}
