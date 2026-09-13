import { strFromU8, strToU8, unzipSync, zipSync, type Zippable } from 'fflate';
import type { Warning } from '../src/index.js';

/**
 * Minimal .docx text rewriting that keeps the document's formatting.
 *
 * Word stores visible text in `<w:t>` elements inside runs, and splits runs at any formatting
 * or editing-session change, often in the middle of a word. Converting each run on its own
 * would break digraphs (`s|h`) and positional rules, so each paragraph is converted in spans
 * that never cut through a whitespace-delimited token: a token that crosses a run boundary is
 * converted as a whole and written into the run where it starts. The only formatting that can
 * be lost is a change inside a single word.
 */

/** Parts of a Word package that can contain body text. */
const TEXT_PART = /^word\/(document|header\d*|footer\d*|footnotes|endnotes|comments)\.xml$/;

interface TextPiece {
  kind: 'text';
  /** Offsets of the element content inside the part's XML. */
  contentStart: number;
  contentEnd: number;
  /** Offsets of the whole `<w:t ...>` start tag, so it can be rewritten with xml:space. */
  tagStart: number;
  tagEnd: number;
  text: string;
}

interface SeparatorPiece {
  kind: 'separator';
  text: string;
}

type Piece = TextPiece | SeparatorPiece;

interface Part {
  name: string;
  xml: string;
  paragraphs: Piece[][];
}

export interface DocxDocument {
  entries: Record<string, Uint8Array>;
  parts: Part[];
  /** Plain text of every paragraph, one per line, for detection and preview. */
  text: string;
}

export interface SpanResult {
  text: string;
  warnings: Warning[];
  /** The text that warning offsets point into. */
  basis: string;
}

const TOKEN =
  /<\?[\s\S]*?\?>|<!--[\s\S]*?-->|<!\[CDATA\[[\s\S]*?\]\]>|<(\/?)([A-Za-z_][\w.:-]*)((?:[^>"']|"[^"]*"|'[^']*')*?)(\/?)>/g;

function decodeXml(text: string): string {
  return text.replace(/&(#x[0-9a-fA-F]+|#\d+|amp|lt|gt|quot|apos);/g, (_, entity: string) => {
    if (entity === 'amp') return '&';
    if (entity === 'lt') return '<';
    if (entity === 'gt') return '>';
    if (entity === 'quot') return '"';
    if (entity === 'apos') return "'";
    const code = entity[1] === 'x' ? parseInt(entity.slice(2), 16) : parseInt(entity.slice(1), 10);
    return String.fromCodePoint(code);
  });
}

function encodeXml(text: string): string {
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function parseParagraphs(xml: string): Piece[][] {
  const paragraphs: Piece[][] = [];
  // Text boxes nest paragraphs inside runs, so track a stack of open paragraphs.
  const open: Piece[][] = [];
  let pendingText: { tagStart: number; tagEnd: number } | undefined;

  TOKEN.lastIndex = 0;
  for (let match = TOKEN.exec(xml); match !== null; match = TOKEN.exec(xml)) {
    const [whole, closing, name, , selfClosing] = match;
    if (name === undefined) continue;
    const current = open[open.length - 1];

    if (name === 'w:p') {
      if (selfClosing) continue;
      if (closing) {
        const finished = open.pop();
        if (finished && finished.length > 0) paragraphs.push(finished);
      } else {
        open.push([]);
      }
      continue;
    }
    if (current === undefined) continue;

    if (name === 'w:t') {
      if (closing) {
        if (pendingText) {
          const contentStart = pendingText.tagEnd;
          const contentEnd = match.index;
          current.push({
            kind: 'text',
            contentStart,
            contentEnd,
            tagStart: pendingText.tagStart,
            tagEnd: pendingText.tagEnd,
            text: decodeXml(xml.slice(contentStart, contentEnd)),
          });
        }
        pendingText = undefined;
      } else if (!selfClosing) {
        pendingText = { tagStart: match.index, tagEnd: match.index + whole.length };
      }
      continue;
    }
    if (!closing && (name === 'w:tab' || name === 'w:ptab')) {
      current.push({ kind: 'separator', text: '\t' });
    } else if (!closing && (name === 'w:br' || name === 'w:cr')) {
      current.push({ kind: 'separator', text: '\n' });
    }
  }
  return paragraphs;
}

export function readDocx(buffer: ArrayBuffer | Uint8Array): DocxDocument {
  const entries = unzipSync(buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer));
  if (!entries['word/document.xml']) throw new Error('not-docx');

  const names = Object.keys(entries)
    .filter((name) => TEXT_PART.test(name))
    // Body text first so detection and the preview start with the document itself.
    .sort(
      (left, right) => Number(right === 'word/document.xml') - Number(left === 'word/document.xml'),
    );

  const parts: Part[] = names.map((name) => {
    const xml = strFromU8(entries[name]!);
    return { name, xml, paragraphs: parseParagraphs(xml) };
  });
  const text = parts
    .flatMap((part) => part.paragraphs.map((pieces) => pieces.map((piece) => piece.text).join('')))
    .join('\n');
  return { entries, parts, text };
}

/** Split a paragraph into one span per text piece without cutting any non-space token. */
function spansFor(pieces: Piece[]): { full: string; spans: { start: number; end: number }[] } {
  const bounds: { start: number; end: number }[] = [];
  let full = '';
  for (const piece of pieces) {
    bounds.push({ start: full.length, end: full.length + piece.text.length });
    full += piece.text;
  }
  const isSpace = (index: number) => /\s/u.test(full[index] ?? ' ');

  const spans = pieces.map((piece, index) => {
    const bound = bounds[index]!;
    if (piece.kind !== 'text') return { start: bound.start, end: bound.start };
    let start = bound.start;
    // Characters continuing a token from an earlier piece belong to that piece's span.
    if (start > 0 && !isSpace(start - 1)) {
      while (start < bound.end && !isSpace(start)) start += 1;
    }
    if (start >= bound.end) return { start: bound.end, end: bound.end };
    let end = bound.end;
    // A token that runs past this piece is finished here.
    if (!isSpace(end - 1)) {
      while (end < full.length && !isSpace(end)) end += 1;
    }
    return { start, end };
  });
  return { full, spans };
}

/**
 * Rewrite every text span with `convert` and return the new package bytes, a plain-text
 * preview, and each span's result for the review panel.
 */
export function convertDocx(
  doc: DocxDocument,
  convert: (text: string) => SpanResult,
): { bytes: Uint8Array; text: string; spans: { source: string; result: SpanResult }[] } {
  const spans: { source: string; result: SpanResult }[] = [];
  const preview: string[] = [];
  const files: Zippable = {};

  for (const [name, data] of Object.entries(doc.entries)) files[name] = data;

  for (const part of doc.parts) {
    const edits: { start: number; end: number; value: string }[] = [];
    for (const pieces of part.paragraphs) {
      const { full, spans: ranges } = spansFor(pieces);
      let paragraphText = '';
      pieces.forEach((piece, index) => {
        if (piece.kind !== 'text') {
          paragraphText += piece.text;
          return;
        }
        const range = ranges[index]!;
        const source = full.slice(range.start, range.end);
        const result = source ? convert(source) : { text: '', warnings: [], basis: '' };
        if (source) spans.push({ source, result });
        paragraphText += result.text;
        // Leading or trailing spaces are dropped by Word unless xml:space="preserve" is set.
        const tag = part.xml.slice(piece.tagStart, piece.tagEnd);
        const preserved = /xml:space=/.test(tag)
          ? tag
          : tag.replace(/^<w:t/, '<w:t xml:space="preserve"');
        edits.push({ start: piece.tagStart, end: piece.tagEnd, value: preserved });
        edits.push({
          start: piece.contentStart,
          end: piece.contentEnd,
          value: encodeXml(result.text),
        });
      });
      preview.push(paragraphText);
    }
    let xml = part.xml;
    for (const edit of edits.sort((left, right) => right.start - left.start)) {
      xml = xml.slice(0, edit.start) + edit.value + xml.slice(edit.end);
    }
    files[part.name] = strToU8(xml);
  }

  return { bytes: zipSync(files, { level: 6 }), text: preview.join('\n'), spans };
}
