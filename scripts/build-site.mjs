import { Buffer } from 'node:buffer';
import { createHash } from 'node:crypto';
import { copyFile, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { basename } from 'node:path';
import { fileURLToPath, pathToFileURL, URL } from 'node:url';
import { build } from 'esbuild';

const projectRoot = fileURLToPath(new URL('..', import.meta.url));
const outdir = fileURLToPath(new URL('../_site/', import.meta.url));

await rm(outdir, { recursive: true, force: true });
await mkdir(outdir, { recursive: true });

const shared = {
  absWorkingDir: projectRoot,
  outdir: '_site',
  bundle: true,
  minify: true,
  format: 'esm',
  platform: 'browser',
  target: 'es2020',
  legalComments: 'none',
  // Content-hashed names: a new release never reuses a cached file from an older one, so
  // browsers cannot combine a fresh page with a stale script or stylesheet.
  entryNames: '[name]-[hash]',
  metafile: true,
};

/** Build one entry point and return its hashed output file name. */
async function bundle(entry, options = {}) {
  const result = await build({ ...shared, entryPoints: [entry], ...options });
  return basename(Object.keys(result.metafile.outputs).find((file) => file.endsWith('.js')));
}

const workerFile = await bundle('site/worker.ts');
const appFile = await bundle('site/app.ts', {
  define: { __WORKER_URL__: JSON.stringify(`./${workerFile}`) },
});

const css = await readFile(new URL('../site/style.css', import.meta.url));
const cssFile = `style-${createHash('sha256').update(css).digest('hex').slice(0, 8)}.css`;
await writeFile(new URL(cssFile, pathToFileURL(outdir)), css);

// Load the interface strings so index.html ships with readable Uzbek text and labels.
const stringsBuild = await build({
  absWorkingDir: projectRoot,
  entryPoints: ['site/i18n.ts'],
  bundle: true,
  format: 'esm',
  platform: 'node',
  write: false,
});
const i18n = await import(
  `data:text/javascript;base64,${Buffer.from(stringsBuild.outputFiles[0].text).toString('base64')}`
);
const text = i18n.STRINGS.uz;
const escapeHtml = (value) =>
  value.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;');
const escapeAttribute = (value) => escapeHtml(value).replaceAll('"', '&quot;');
const lookup = (key) => {
  if (!(key in text)) throw new Error(`index.html references unknown string "${key}"`);
  return text[key];
};

let html = await readFile(new URL('../site/index.html', import.meta.url), 'utf8');
html = html.replace(
  /(<([a-z0-9]+)\b[^>]*\bdata-i18n="([\w]+)"[^>]*>)\s*(<\/\2>)/g,
  (_, open, _tag, key, close) => `${open}${escapeHtml(lookup(key))}${close}`,
);
html = html.replace(
  /<([a-z]+)\b([^>]*\bdata-i18n-title="([\w]+)"[^>]*)>/g,
  (_, tag, attributes, key) => {
    const label = escapeAttribute(lookup(key));
    return `<${tag}${attributes} title="${label}" aria-label="${label}">`;
  },
);
html = html.replace(
  'id="input"',
  `id="input" placeholder="${escapeAttribute(lookup('placeholder'))}"`,
);

const references = [
  ['./style.css', `./${cssFile}`],
  ['./app.js', `./${appFile}`],
];
for (const [from, to] of references) {
  if (!html.includes(`"${from}"`)) throw new Error(`index.html no longer references ${from}`);
  html = html.replace(`"${from}"`, `"${to}"`);
}
const unfilled = html.match(/data-i18n="\w+"[^>]*>\s*</g);
if (unfilled) throw new Error(`Untranslated elements left empty: ${unfilled.join(', ')}`);
await writeFile(new URL('index.html', pathToFileURL(outdir)), html);

// Icons and the link preview image keep fixed names: browser tabs and absolute URLs reference them.
for (const file of ['og.png', 'favicon.svg', 'apple-touch-icon.png']) {
  await copyFile(new URL(`../site/${file}`, import.meta.url), new URL(file, pathToFileURL(outdir)));
}

// Serve files as-is; GitHub Pages would otherwise run Jekyll.
await writeFile(new URL('.nojekyll', pathToFileURL(outdir)), '');

process.stdout.write(`Site built in _site/ (${appFile}, ${workerFile}, ${cssFile}).\n`);
