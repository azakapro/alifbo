// Generate python/tests/parity.json from the built TypeScript library.
// Usage: npm ci && npm run build && node scripts/gen-python-parity.mjs
import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import * as alifbo from '../dist/index.js';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const output = join(root, 'python/tests/parity.json');

const inputs = [];
const sectionOf = new Map();
let section = 'corpus';
function add(...values) {
  for (const value of values.flat()) {
    if (typeof value !== 'string' || sectionOf.has(value)) continue;
    sectionOf.set(value, section);
    inputs.push(value);
  }
}

// 1. Golden corpus inputs and expectations.
const corpusDirectory = join(root, 'test/corpus');
for (const file of readdirSync(corpusDirectory).sort()) {
  for (const testCase of JSON.parse(readFileSync(join(corpusDirectory, file), 'utf8'))) {
    add(testCase.input, testCase.expected);
  }
}

// 2. Every plain string literal in the TypeScript test files.
section = 'test-literals';
const literal = /'(?:[^'\\\n]|\\.)*'|"(?:[^"\\\n]|\\.)*"|`(?:[^`\\]|\\.)*`/gu;
for (const file of readdirSync(join(root, 'test')).sort()) {
  // Site tests exercise the demo (file formats, UI), not library behavior.
  if (!file.endsWith('.test.ts') || file.startsWith('site-')) continue;
  const source = readFileSync(join(root, 'test', file), 'utf8');
  for (const match of source.matchAll(literal)) {
    if (match[0].startsWith('`') && match[0].includes('${')) continue;
    add(new Function(`return ${match[0]};`)());
  }
}

// 3. Generated tricky cases.
section = 'matrix';
const apostrophes = ['ʻ', 'ʼ', "'", '‘', '’', '`', '´', '′', '＇'];
for (const a of apostrophes) {
  add([`o${a}`, `O${a}`, `g${a}`, `G${a}`, `A${a}A`, `a${a}b`, `${a}`, `${a}o`]);
  add([`s${a}h S${a}H`, `o${a}${a} g${a}g${a}`, `ng${a} tong${a}`, `c${a}h O${a}zbekiston`]);
}
add(apostrophes.map((a) => `yo${a}l ${a}a${a}`).join(' '));

const title = (word) => word.slice(0, 1).toUpperCase() + word.slice(1);
const casedWords = [
  'shahar',
  'choʻl',
  'oʻzbekiston',
  'gʻalaba',
  'tong',
  'asʼhob',
  'ishoq',
  'ashob',
  'toshkent',
  'chempion',
  'singil',
  'yoʻl',
  'yulduz',
  'yangi',
  'tsirk',
  'shchi',
  'ssh cch',
  'şahar',
  'çöl',
  'özbekiston',
  'ğalaba',
  'quyoş',
  'şçyolk',
  'tş',
  'eşik',
];
for (const word of casedWords) add([word, title(word), word.toUpperCase()]);
section = 'tricky';

add(
  [
    'Oʻzbekiston, şahar, gʻoya',
    'Шавкат Ўзбекистон йўл',
    'ё й Ё Й ЁЛҒИЗ',
    'Özbekiston Ğalaba Şahar Çöl',
    'CaféSh sh',
  ].map((value) => value.normalize('NFD')),
);
add(['șahar Șahar ȘAHAR', 'ș', 'Ș', 'șç', 'Șavkat', 'ȘAHAR ÇÖĞ']);

add([
  'https://example.uz/shahar shahar',
  'http://a.b/`sh` sh',
  'www.shahar.uz/sh sh',
  'HTTPS://X.UZ/sh sh',
  'ftp://x.uz/sh sh',
  'https://x.uz\u00a0sh',
  'https://x.uz\u2003sh',
  'https://x.uz\u0085sh',
  'https://x.uz\u001csh',
  'https://x.uz\ufeffsh',
  'https://x.uz\u2028sh',
  'https://example.uz/е Елена',
  'a@b.cc_d@e.ff sh',
  'x@y.z sh',
  'user.name+tag@mail.example.com shahar',
  'foo@bar sh',
  'foo@@bar.uz sh',
  '@example.uz sh',
  'sh@ex-ample.uz.a1 sh',
  'sh@example.uz1 ch',
  'sh@1.2.ab3 sh',
  'почта@пример.уз ш',
  'e\u0301@x.uz sh',
  'a@b.c.dd.e sh',
  'sh@x.uz@y.uz ch',
  '`sh`',
  '``sh`` sh',
  '`sh\nsh` sh',
  '` sh',
  'o`sh` ch',
  '`Шавкат` Шавкат',
  'Photoshop Shakespeare Chelsea chelsea',
  'PhotoshopShakespeare sh',
  'MyShop shahar',
]);

add([
  'ashob',
  'ashobs',
  'xashob',
  '1ashob',
  'ashob1',
  'ashob-ashob',
  "ashob'",
  'ASHOB Ashob aShob',
  'ashob\u0301 sh',
  'Ishoq, ISHOQ.',
  'ашоб ashob',
  'tong Tong TONG',
  'tongʻ',
  "ng' ng",
  'nG Ng n g ngh nsh nch',
  'asʼhob',
  "as'hob",
  'as’hob',
  'Sʼh sʼH sʻh',
  'e şç yo yu ya ʼ',
  'YO Yo yO TS Ts tS',
  'c C ch Ch',
  'şçş ŞÇ ŞçŞ',
  'mayor Oʻzbekiston w q x',
  '123 !?',
  'Özbekiston oʻzbek',
  'Shakespeare',
  'i I ish ISH И ИШ',
  'İ ı',
  'shahar\nchoʻl\r\n\tОЛМА',
  'QUYOŞ TOŞKENT ÇÖL',
  '',
]);

const cyrillicPairs = [
  ['а', 'А'],
  ['б', 'Б'],
  ['в', 'В'],
  ['г', 'Г'],
  ['д', 'Д'],
  ['е', 'Е'],
  ['ё', 'Ё'],
  ['ж', 'Ж'],
  ['з', 'З'],
  ['и', 'И'],
  ['й', 'Й'],
  ['к', 'К'],
  ['л', 'Л'],
  ['м', 'М'],
  ['н', 'Н'],
  ['о', 'О'],
  ['п', 'П'],
  ['р', 'Р'],
  ['с', 'С'],
  ['т', 'Т'],
  ['у', 'У'],
  ['ф', 'Ф'],
  ['х', 'Х'],
  ['ц', 'Ц'],
  ['ч', 'Ч'],
  ['ш', 'Ш'],
  ['щ', 'Щ'],
  ['ъ', 'Ъ'],
  ['ы', 'Ы'],
  ['ь', 'Ь'],
  ['э', 'Э'],
  ['ю', 'Ю'],
  ['я', 'Я'],
  ['ў', 'Ў'],
  ['қ', 'Қ'],
  ['ғ', 'Ғ'],
  ['ҳ', 'Ҳ'],
];
section = 'matrix';
for (const [l, u] of cyrillicPairs) {
  add(`${l} ${l}ата а${l}а б${l}а ${l}${l} ъ${l} ь${l} 1${l} -${l}`);
  add(`${u} ${u}АТА А${u}А Б${u}А ${u}${l} Т${u}А ${u}${u}`);
}
section = 'tricky';
add([
  'Елена, театр',
  'цирк пицца',
  'объект роль',
  'Юлдуз Яҳё',
  'Ўзбекистон ҚЎҚОН',
  'съезд подъезд меҳмон шоир',
  'щи ЩЁТКА Цех ЦЕХ',
  'Шавкат Şavkat shahar',
  'Тошкент shahri va Özbekiston',
]);

add([
  '😀',
  '😀е 𝐀е',
  'sh😀sh',
  '𝐀shahar',
  'е😀ц 𝐀ц',
  'a😀@b.uz sh',
  '😀@example.uz sh',
  'a@😀.uz sh',
  'sh@𝐀𝐁.uz sh',
  'sh@x.𝐀𝐁 ch',
  'https://x.uz/😀 sh',
  'ashob😀 😀ashob 𝐀ashob ashob𝐀',
  '👨‍👩‍👧 оила',
  '`😀sh` sh',
  'Ş😀 ŞA😀 😀Ş',
  'yo😀ts 😀e ʼ😀',
  '😀 Елена 😀 театр',
]);

// 4. Round-trip property samples (same generator as test/latin.test.ts).
section = 'round-trip';
const tokens = [
  'a',
  'b',
  'd',
  'e',
  'f',
  'g',
  'gʻ',
  'h',
  'i',
  'j',
  'k',
  'l',
  'm',
  'n',
  'ng',
  'o',
  'oʻ',
  'p',
  'q',
  'r',
  's',
  'sh',
  't',
  'u',
  'v',
  'x',
  'y',
  'z',
  'ch',
  'ʼ',
];
let state = 0x5eed1234;
function next() {
  state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
  return state;
}
for (let sample = 0; sample < 60; sample += 1) {
  let input = '';
  for (let length = 0; length < 24; length += 1) input += tokens[next() % tokens.length];
  add(input);
}

// 5. Deterministic fuzz over a hostile alphabet.
section = 'fuzz';
const fuzzAlphabet = [
  ...cyrillicPairs.flat(),
  ...'abcdeghijklmnopqrstuvwxyzABCEGHIOSTY',
  ...apostrophes,
  ...['ş', 'Ş', 'ș', 'Ș', 'ö', 'Ö', 'ğ', 'ç', 'Ç', 'İ', 'ı'],
  ...[' ', ' ', '\n', '.', '@', '/', ':', '-', '_', '1', '\u0301', '\u0306', '\u00a0'],
  ...['😀', '𝐀', 'https://', 'www.', 'sh', 'ch', 'ng', 'yo', 'ts', 'ashob', 'Photoshop'],
];
state = 0x0a11fb0;
for (let sample = 0; sample < 150; sample += 1) {
  let input = '';
  const length = next() % 21;
  for (let index = 0; index < length; index += 1)
    input += fuzzAlphabet[next() % fuzzAlphabet.length];
  add(input);
}

// Option variants exercised for every conversion function on a focused input set.
const optionVariants = [
  { protectSpans: false },
  { ngAsDigraph: false },
  { protectedTerms: ['MyShop', 'CaféSh', 'Cafe\u0301Sh', 'Шавкат', 'sh', ''] },
  {
    exceptions: {
      sh: 'X',
      shahar: 'Y',
      şahar: 'city',
      Шавкат: 'Sh',
      10: 'ten',
      2: 'two',
      ashob: 'ASHOB',
      е: 'э',
      '😀': 'smile',
    },
  },
  {
    protectSpans: false,
    ngAsDigraph: false,
    protectedTerms: ['Photoshop'],
    exceptions: { Toshkent: 'Tashkent', tong: 'ong' },
  },
];

const conversions = ['toNewLatin', 'toOldLatin', 'fromCyrillic', 'toCyrillic'];
const plain = [
  'foldSearchKey',
  'foldSearchKeyLoose',
  'normalizeApostrophes',
  'normalizeConfusables',
  'detectAlphabet',
];

const cases = [];
function run(fn, input, options) {
  const result = options === undefined ? alifbo[fn](input) : alifbo[fn](input, options);
  const entry = { fn, input };
  if (options !== undefined) entry.options = options;
  entry.output = result;
  cases.push(entry);
}

for (const input of inputs) {
  for (const fn of conversions) run(fn, input);
  for (const fn of plain) run(fn, input);
}

const optionSections = new Set(['corpus', 'tricky']);
const optionInputs = inputs.filter(
  (input, index) => optionSections.has(sectionOf.get(input)) || index % 4 === 0,
);
for (const options of optionVariants) {
  for (const input of optionInputs) {
    for (const fn of conversions) run(fn, input, options);
  }
}

const body = cases.map((entry) => `    ${JSON.stringify(entry)}`).join(',\n');
writeFileSync(
  output,
  `{\n  "generatedBy": "scripts/gen-python-parity.mjs",\n  "cases": [\n${body}\n  ]\n}\n`,
  'utf8',
);
process.stdout.write(`Wrote ${cases.length} parity cases to python/tests/parity.json\n`);
