#!/usr/bin/env node
import { readFileSync } from 'node:fs';
import { fromCyrillic, toCyrillic, toNewLatin, toOldLatin } from './index.js';
import type { ConversionResult, Warning } from './index.js';

const USAGE = `Usage: alifbo convert --to <new-latin|old-latin|cyrillic> [file]

Reads standard input when no file is provided. Converted text is written to
standard output and ambiguity warnings are written to standard error.
`;

function usage(exitCode: number): never {
  const stream = exitCode === 0 ? process.stdout : process.stderr;
  stream.write(USAGE);
  process.exit(exitCode);
}

function printWarning(item: Warning): void {
  const alternatives = item.alternatives?.map((value) => JSON.stringify(value)).join(', ');
  process.stderr.write(
    `alifbo: warning [${item.rule}] at ${item.index}:${item.length}: ${item.message}${alternatives === undefined ? '' : ` Alternatives: ${alternatives}.`}\n`,
  );
}

const arguments_ = process.argv.slice(2);
if (arguments_.includes('--help') || arguments_.includes('-h')) usage(0);
if (arguments_[0] !== 'convert') usage(2);
const toIndex = arguments_.indexOf('--to');
const target = arguments_[toIndex + 1];
if (toIndex < 0 || target === undefined) usage(2);
if (target !== 'new-latin' && target !== 'old-latin' && target !== 'cyrillic') usage(2);
const file = arguments_.find(
  (argument, index) =>
    index > 0 && index !== toIndex && index !== toIndex + 1 && !argument.startsWith('-'),
);
const input = file === undefined ? readFileSync(0, 'utf8') : readFileSync(file, 'utf8');

let result: ConversionResult;
if (target === 'new-latin' || target === 'old-latin') {
  const intermediate = fromCyrillic(input);
  const converted =
    target === 'new-latin' ? toNewLatin(intermediate.text) : toOldLatin(intermediate.text);
  result = { text: converted.text, warnings: [...intermediate.warnings, ...converted.warnings] };
} else result = toCyrillic(input);

process.stdout.write(result.text);
for (const item of result.warnings) printWarning(item);
