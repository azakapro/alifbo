/* global document, localStorage, getComputedStyle, innerWidth -- used inside page.evaluate */
// Cross-browser check of the built demo site (_site/) in Chromium, Firefox and WebKit (Safari's
// engine), at desktop and phone sizes. Run `npm run site` first.
//
//   npm run test:browsers                  # all engines
//   BROWSERS=webkit npm run test:browsers  # a subset
import { Buffer } from 'node:buffer';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';
import process from 'node:process';
import { fileURLToPath, URL } from 'node:url';
import { strToU8, zipSync } from 'fflate';
import { chromium, firefox, webkit } from 'playwright';

const siteDir = fileURLToPath(new URL('../_site/', import.meta.url));
const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
};

/** A small Word document: a heading and a paragraph whose bold run splits a word. */
function sampleDocx() {
  const run = (text, bold = false) =>
    `<w:r>${bold ? '<w:rPr><w:b/></w:rPr>' : ''}<w:t xml:space="preserve">${text}</w:t></w:r>`;
  const document = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body>
<w:p>${run('Ўзбек адабиёти')}</w:p>
<w:p>${run('Шаҳар марказида ')}${run('чой', true)}${run('хона бор.')}</w:p>
</w:body></w:document>`;
  return Buffer.from(
    zipSync({
      '[Content_Types].xml': strToU8(
        '<?xml version="1.0" encoding="UTF-8"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/></Types>',
      ),
      '_rels/.rels': strToU8(
        '<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>',
      ),
      'word/document.xml': strToU8(document),
    }),
  );
}

const server = createServer(async (request, response) => {
  const path = normalize(decodeURIComponent(new URL(request.url, 'http://x').pathname));
  const file = join(siteDir, path === '/' ? 'index.html' : path);
  if (!file.startsWith(siteDir)) return response.writeHead(403).end();
  try {
    const body = await readFile(file);
    response.writeHead(200, { 'content-type': TYPES[extname(file)] ?? 'application/octet-stream' });
    response.end(body);
  } catch {
    response.writeHead(404).end();
  }
});
await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
const url = `http://127.0.0.1:${server.address().port}/`;

const engines = { chromium, firefox, webkit };
const selected = (process.env.BROWSERS ?? 'chromium,firefox,webkit').split(',');
const sizes = {
  desktop: { viewport: { width: 1280, height: 860 } },
  phone: { viewport: { width: 390, height: 844 }, hasTouch: true },
};
const docx = sampleDocx();
let failures = 0;

function check(name, condition, detail) {
  if (!condition) {
    failures += 1;
    process.stdout.write(
      `  ✗ ${name}${detail === undefined ? '' : `: ${JSON.stringify(detail)}`}\n`,
    );
  }
  return condition;
}

for (const engineName of selected) {
  const engine = engines[engineName];
  if (!engine) throw new Error(`Unknown browser "${engineName}"`);
  const browser = await engine.launch();

  // Without JavaScript the page must still show real text, not empty elements.
  const noScript = await browser.newContext({ javaScriptEnabled: false });
  const staticPage = await noScript.newPage();
  await staticPage.goto(url);
  const heading = await staticPage.textContent('h1');
  check(
    `${engineName}: heading rendered without JavaScript`,
    heading?.includes('alifbosi'),
    heading,
  );
  await noScript.close();

  for (const [size, options] of Object.entries(sizes)) {
    const label = `${engineName} ${size}`;
    const before = failures;
    const context = await browser.newContext({ ...options, colorScheme: 'light' });
    const page = await context.newPage();
    const errors = [];
    page.on('pageerror', (error) => errors.push(error.message));
    page.on('console', (message) => message.type() === 'error' && errors.push(message.text()));

    await page.goto(url, { waitUntil: 'networkidle' });
    await page.evaluate(() => localStorage.setItem('alifbo.lang', 'uz'));
    await page.reload({ waitUntil: 'networkidle' });

    const styles = await page.evaluate(() => ({
      iconFill: getComputedStyle(document.querySelector('.icon')).fill,
      option: document.querySelector('#from option')?.textContent,
    }));
    check(`${label}: stylesheet applied`, styles.iconFill === 'none', styles);
    check(`${label}: interface text applied`, Boolean(styles.option), styles);

    await page.click('[data-example="cyr"]');
    // The default example also starts with "Özbekiston", so wait for this example's warnings.
    await page.waitForFunction(
      () => Number(document.getElementById('reviewCount').textContent) > 0,
    );
    const review = await page.textContent('#reviewCount');
    check(`${label}: review bar shows a count`, Number(review) > 0, review);
    await page.click('#review summary');
    check(`${label}: review bar expands`, await page.isVisible('#reviewList .group'));

    for (const dialog of ['aboutDialog', 'devDialog']) {
      await page.click(`[data-dialog="${dialog}"]`);
      check(`${label}: ${dialog} opens`, await page.isVisible(`#${dialog}`));
      await page.keyboard.press('Escape');
      await page.waitForTimeout(100);
      check(`${label}: ${dialog} closes with Escape`, !(await page.isVisible(`#${dialog}`)));
    }

    const theme = async () =>
      page.evaluate(() =>
        getComputedStyle(document.documentElement).getPropertyValue('--bg').trim(),
      );
    await page.click('#theme');
    check(`${label}: theme toggles to dark`, (await theme()) === '#0c0e11', await theme());
    await page.reload({ waitUntil: 'networkidle' });
    check(`${label}: theme choice persists`, (await theme()) === '#0c0e11', await theme());
    await page.click('#theme');

    await page.click('#modeDoc');
    await page.setInputFiles('#dropzone .file-input', {
      name: 'hujjat.docx',
      mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      buffer: docx,
    });
    await page.waitForFunction(() => document.getElementById('output').value.includes('çoyxona'));
    const [download] = await Promise.all([page.waitForEvent('download'), page.click('#download')]);
    check(`${label}: converted .docx downloads`, download.suggestedFilename().endsWith('.docx'));

    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - innerWidth);
    check(`${label}: no horizontal overflow`, overflow <= 0, overflow);
    check(`${label}: no console errors`, errors.length === 0, errors);

    process.stdout.write(`${failures === before ? '✓' : '✗'} ${label}\n`);
    await context.close();
  }
  await browser.close();
}

server.close();
if (failures > 0) {
  process.stdout.write(`${failures} browser check(s) failed.\n`);
  process.exit(1);
}
process.stdout.write('All browser checks passed.\n');
