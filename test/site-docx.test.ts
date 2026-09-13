import { strFromU8, strToU8, unzipSync, zipSync } from 'fflate';
import { describe, expect, it } from 'vitest';
import { convertDocx, readDocx } from '../site/docx.js';
import { runDocx } from '../site/engine.js';
import { fromCyrillic, toNewLatin } from '../src/index.js';

const W = 'xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"';

function makeDocx(body: string, extra: Record<string, string> = {}): Uint8Array {
  return zipSync({
    '[Content_Types].xml': strToU8('<?xml version="1.0"?><Types/>'),
    'word/document.xml': strToU8(
      `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:document ${W}><w:body>${body}</w:body></w:document>`,
    ),
    'word/media/image1.png': new Uint8Array([137, 80, 78, 71]),
    ...Object.fromEntries(Object.entries(extra).map(([name, xml]) => [name, strToU8(xml)])),
  });
}

const run = (text: string, bold = false) =>
  `<w:r>${bold ? '<w:rPr><w:b/></w:rPr>' : ''}<w:t xml:space="preserve">${text}</w:t></w:r>`;

function documentXml(bytes: Uint8Array): string {
  return strFromU8(unzipSync(bytes)['word/document.xml']!);
}

const toNew = (text: string) => ({ ...toNewLatin(text), basis: text });

describe('docx conversion', () => {
  it('converts a word split across runs as one token', () => {
    const doc = readDocx(
      makeDocx(`<w:p>${run('Katta s')}${run('hahar', true)}${run(' va choy')}</w:p>`),
    );
    expect(doc.text).toBe('Katta shahar va choy');
    const result = convertDocx(doc, toNew);
    expect(result.text).toBe('Katta şahar va çoy');
    const xml = documentXml(result.bytes);
    // The split token lands in the run where it starts; later runs keep their formatting.
    expect(xml).toContain('<w:t xml:space="preserve">Katta şahar</w:t>');
    expect(xml).toContain('<w:rPr><w:b/></w:rPr><w:t xml:space="preserve"></w:t>');
    expect(xml).toContain('<w:t xml:space="preserve"> va çoy</w:t>');
  });

  it('keeps formatting boundaries that fall between words', () => {
    const doc = readDocx(
      makeDocx(`<w:p>${run('Shahar ')}${run('choyxona', true)}${run(' bor')}</w:p>`),
    );
    const xml = documentXml(convertDocx(doc, toNew).bytes);
    expect(xml).toContain('>Şahar </w:t>');
    expect(xml).toContain('<w:b/></w:rPr><w:t xml:space="preserve">çoyxona</w:t>');
  });

  it('treats tabs and breaks as separators and adds xml:space where needed', () => {
    const doc = readDocx(
      makeDocx('<w:p><w:r><w:t>sh</w:t><w:tab/><w:t>ch</w:t><w:br/><w:t> oʻ</w:t></w:r></w:p>'),
    );
    expect(doc.text).toBe('sh\tch\n oʻ');
    const xml = documentXml(convertDocx(doc, toNew).bytes);
    expect(xml).toContain('<w:t xml:space="preserve">ş</w:t><w:tab/>');
    expect(xml).toContain('<w:t xml:space="preserve"> ö</w:t>');
  });

  it('decodes and re-encodes XML entities', () => {
    const doc = readDocx(makeDocx(`<w:p>${run('A &amp; B &lt;shahar&gt; &#1096;')}</w:p>`));
    expect(doc.text).toBe('A & B <shahar> ш');
    expect(documentXml(convertDocx(doc, toNew).bytes)).toContain('A &amp; B &lt;şahar&gt; ш');
  });

  it('handles paragraphs nested in text boxes and header parts', () => {
    const header = `<w:hdr ${W}><w:p>${run('Chiroyli')}</w:p></w:hdr>`;
    const body = `<w:p><w:r><w:t>Tashqi </w:t></w:r><w:r><w:pict><w:txbxContent><w:p>${run('ichki shahar')}</w:p></w:txbxContent></w:pict></w:r><w:r><w:t>matn</w:t></w:r></w:p>`;
    const bytes = makeDocx(body, { 'word/header1.xml': header });
    const result = convertDocx(readDocx(bytes), toNew);
    const files = unzipSync(result.bytes);
    expect(strFromU8(files['word/header1.xml']!)).toContain('Çiroyli');
    expect(documentXml(result.bytes)).toContain('içki şahar');
    expect(result.text.split('\n')).toEqual(['içki şahar', 'Taşqi matn', 'Çiroyli']);
    expect([...files['word/media/image1.png']!]).toEqual([137, 80, 78, 71]);
  });

  it('rejects files that are not Word documents', () => {
    expect(() => readDocx(zipSync({ 'hello.txt': strToU8('hi') }))).toThrow('not-docx');
  });

  it('reports review warnings against each span', () => {
    const doc = readDocx(makeDocx(`<w:p>${run('Елена ')}${run('театр', true)}</w:p>`));
    const result = runDocx(doc, {
      id: 1,
      from: 'auto',
      to: 'new-latin',
      options: {},
    });
    expect(result.source).toBe('cyrillic');
    expect(result.text).toBe(fromCyrillic('Елена театр').text);
    expect(result.warningCount).toBe(3);
    const words = result.groups.flatMap((group) =>
      group.words.map((word) => word.before + word.hit + word.after),
    );
    expect(words).toEqual(expect.arrayContaining(['Елена', 'театр']));
  });
});
