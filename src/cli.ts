#!/usr/bin/env node
import { readFileSync } from 'node:fs';
import { fromCyrillic, toCyrillic, toNewLatin, toOldLatin } from './index.js';

function usage(): never {
  process.stderr.write('Usage: alifbo convert --to <new-latin|old-latin|cyrillic> [file]\n');
  process.exit(2);
}

const arguments_ = process.argv.slice(2);
if (arguments_[0] !== 'convert') usage();
const toIndex = arguments_.indexOf('--to');
const target = arguments_[toIndex + 1];
if (toIndex < 0 || target === undefined) usage();
const file = arguments_.find(
  (argument, index) =>
    index > 0 && index !== toIndex && index !== toIndex + 1 && !argument.startsWith('-'),
);
const input = file === undefined ? readFileSync(0, 'utf8') : readFileSync(file, 'utf8');

let text: string;
if (target === 'new-latin') text = toNewLatin(fromCyrillic(input).text).text;
else if (target === 'old-latin') text = toOldLatin(fromCyrillic(input).text).text;
else if (target === 'cyrillic') text = toCyrillic(input).text;
else usage();

process.stdout.write(text);
