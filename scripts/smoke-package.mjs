import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const esm = await import('../dist/index.js');
const cjs = require('../dist/index.cjs');

assert.equal(esm.toNewLatin('Shahar').text, 'Şahar');
assert.equal(cjs.toOldLatin('Şahar').text, 'Shahar');

const cli = spawnSync(process.execPath, ['dist/cli.js', 'convert', '--to', 'new-latin'], {
  input: 'Шавкат',
  encoding: 'utf8',
});
assert.equal(cli.status, 0, cli.stderr);
assert.equal(cli.stdout, 'Şavkat');

process.stdout.write('ESM, CommonJS, and CLI package smoke tests passed.\n');
