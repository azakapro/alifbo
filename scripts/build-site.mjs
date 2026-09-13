import { copyFile, mkdir, rm, writeFile } from 'node:fs/promises';
import { fileURLToPath, URL } from 'node:url';
import { build } from 'esbuild';

const projectRoot = fileURLToPath(new URL('..', import.meta.url));
const outdir = fileURLToPath(new URL('../_site/', import.meta.url));

await rm(outdir, { recursive: true, force: true });
await mkdir(outdir, { recursive: true });

await build({
  absWorkingDir: projectRoot,
  entryPoints: ['site/app.ts', 'site/worker.ts'],
  outdir: '_site',
  bundle: true,
  minify: true,
  format: 'esm',
  platform: 'browser',
  target: 'es2020',
  legalComments: 'none',
});

for (const file of ['index.html', 'style.css']) {
  await copyFile(new URL(`../site/${file}`, import.meta.url), new URL(file, `file://${outdir}`));
}
// Serve files as-is; GitHub Pages would otherwise run Jekyll.
await writeFile(new URL('.nojekyll', `file://${outdir}`), '');

process.stdout.write('Site built in _site/.\n');
