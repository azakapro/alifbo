import assert from 'node:assert/strict';
import { Buffer } from 'node:buffer';
import { fileURLToPath, URL } from 'node:url';
import { build } from 'esbuild';

const projectRoot = fileURLToPath(new URL('..', import.meta.url));
const result = await build({
  absWorkingDir: projectRoot,
  entryPoints: ['src/index.ts'],
  bundle: true,
  format: 'esm',
  platform: 'browser',
  target: ['es2022'],
  write: false,
});

assert.equal(result.outputFiles.length, 1);
const source = result.outputFiles[0].text;
const moduleUrl = `data:text/javascript;base64,${Buffer.from(source).toString('base64')}`;
const browserBundle = await import(moduleUrl);

assert.equal(browserBundle.toNewLatin("O'zbekiston shaharlari").text, 'Özbekiston şaharlari');
assert.equal(browserBundle.foldSearchKey('Шавкат'), 'şavkat');

process.stdout.write('Browser bundle smoke test passed.\n');
