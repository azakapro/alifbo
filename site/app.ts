import type { ConversionOptions } from '../src/index.js';
import {
  run,
  WORDS_PER_GROUP,
  type ConvertRequest,
  type ConvertResponse,
  type Source,
  type Target,
} from './engine.js';

type Lang = 'uz' | 'en';

const STRINGS = {
  uz: {
    title: 'Oʻzbek matnini yangi lotin alifbosiga oʻgiring',
    subtitle:
      'Kirill, amaldagi lotin va 2026-yilgi yangi lotin alifbolari oʻrtasida. Noaniq joylarni koʻrsatib beradi.',
    from: 'Qaysi alifbodan',
    to: 'Qaysi alifboga',
    auto: 'Avtomatik aniqlash',
    cyrillic: 'Kirill',
    oldLatin: 'Amaldagi lotin (oʻ, gʻ, sh, ch)',
    newLatin: 'Yangi lotin (ö, ğ, ş, ç)',
    swap: 'Almashtirish',
    detected: 'Aniqlandi: ',
    input: 'Matn',
    output: 'Natija',
    openFile: 'Fayl ochish',
    clear: 'Tozalash',
    copy: 'Nusxa olish',
    copied: 'Nusxa olindi ✓',
    download: 'Yuklab olish',
    tryExample: 'Misol:',
    privacy: 'Matn brauzeringizdan chiqmaydi.',
    working: 'Oʻgirilmoqda…',
    placeholder: 'Matnni shu yerga yozing yoki joylashtiring…',
    chars: 'belgi',
    options: 'Sozlamalar',
    protectSpans: 'Havolalar, email manzillar va `kod` qismlarini oʻzgartirmaslik',
    protectedTerms: 'Oʻzgartirilmaydigan soʻzlar (vergul bilan):',
    review: 'Tekshirib chiqing',
    reviewEmpty: 'Noaniq joylar topilmadi.',
    alternatives: 'Boshqa variantlar: ',
    devTitle: 'Dasturchilar uchun',
    devText:
      'Bu sahifa ochiq kodli alifbo kutubxonasida ishlaydi: TypeScript, bogʻliqliklarsiz, Node va brauzerda.',
    report: 'Xato haqida xabar berish',
    legal:
      'Senat yangi alifbo haqidagi qonunni 2026-yil 10-sentabrda maʼqulladi. Rasmiy matn lex.uz saytida eʼlon qilinishi bilan qoidalar yangilanadi. Muhim hujjatlarni har doim tekshirib chiqing.',
  },
  en: {
    title: 'Convert Uzbek text to the new Latin alphabet',
    subtitle:
      'Between Cyrillic, the current Latin alphabet and the new 2026 Latin alphabet. Ambiguous spots are flagged for review.',
    from: 'From',
    to: 'To',
    auto: 'Detect automatically',
    cyrillic: 'Cyrillic',
    oldLatin: 'Current Latin (oʻ, gʻ, sh, ch)',
    newLatin: 'New Latin (ö, ğ, ş, ç)',
    swap: 'Swap',
    detected: 'Detected: ',
    input: 'Text',
    output: 'Result',
    openFile: 'Open file',
    clear: 'Clear',
    copy: 'Copy',
    copied: 'Copied ✓',
    download: 'Download',
    tryExample: 'Try:',
    privacy: 'Your text never leaves your browser.',
    working: 'Converting…',
    placeholder: 'Type or paste Uzbek text here…',
    chars: 'chars',
    options: 'Options',
    protectSpans: 'Leave links, email addresses and `code` unchanged',
    protectedTerms: 'Words to leave unchanged (comma-separated):',
    review: 'Review these',
    reviewEmpty: 'No ambiguous spots found.',
    alternatives: 'Alternatives: ',
    devTitle: 'For developers',
    devText:
      'This page runs on alifbo, an open-source TypeScript library with zero dependencies for Node and the browser.',
    report: 'Report a problem',
    legal:
      'Uzbekistan’s Senate approved the new alphabet law on 10 September 2026. Rules will be updated once the official text is published on lex.uz. Always proofread important documents.',
  },
} as const;

type Key = keyof (typeof STRINGS)['en'];

const RULES: Record<Lang, Record<string, string>> = {
  uz: {
    'cyrillic.e.positional':
      '«е» soʻz boshida va unlidan keyin «ye», boshqa joyda «e» deb yozildi. Ayniqsa chet soʻzlarda tekshiring.',
    'cyrillic.tse.positional': '«ц» soʻz boshida «s», boshqa joyda «ts» deb yozildi.',
    'cyrillic.shcha.ambiguous': '«щ» harfining yangi lotinda aniq mosi yoʻq; «şç» tanlandi.',
    'cyrillic.hard-sign.ambiguous': 'Ayirish belgisi «ъ» tutuq belgisi «ʼ» bilan almashtirildi.',
    'cyrillic.soft-sign.ambiguous': 'Yumshatish belgisi «ь» tushirib qoldirildi.',
    'cyrillic.compound': '«ё», «ю», «я» ikki harf bilan (yo, yu, ya) yozildi.',
    'latin.e.ambiguous':
      'Lotin «e» soʻz boshida va unlidan keyin «э», boshqa joyda «е» deb yozildi. Chet soʻzlarda tekshiring.',
    'latin.ye.positional':
      '«ye» soʻz boshida, unlidan yoki tutuq belgisidan keyin «е» deb yozildi.',
    'latin.tse.ambiguous': '«ts» kirill «ц» deb oʻqildi, lekin «тс» boʻlishi ham mumkin.',
    'latin.shcha.ambiguous': '«şç» kirill «щ» deb oʻqildi, lekin «шч» boʻlishi ham mumkin.',
    'latin.iotated': '«yo», «yu», «ya» bitta kirill harfi (ё, ю, я) deb oʻqildi.',
    'latin.tutuq.ambiguous': 'Tutuq belgisi «ъ» deb oʻqildi; «ь» yoki hech narsa boʻlishi mumkin.',
    'latin.c.ambiguous': 'Yakka «c» kirill «ц» deb oʻqildi.',
  },
  en: {
    'cyrillic.e.positional':
      'е became “ye” at a word start or after a vowel, and “e” elsewhere. Check foreign words especially.',
    'cyrillic.tse.positional': 'ц became “s” at a word start and “ts” elsewhere.',
    'cyrillic.shcha.ambiguous': 'щ has no exact new-Latin equivalent; “şç” was chosen.',
    'cyrillic.hard-sign.ambiguous': 'The hard sign ъ was written as the tutuq sign ʼ.',
    'cyrillic.soft-sign.ambiguous': 'The soft sign ь was dropped.',
    'cyrillic.compound': 'ё, ю and я were written as two letters (yo, yu, ya).',
    'latin.e.ambiguous':
      'Latin e became э at a word start or after a vowel, and е elsewhere. Check foreign words especially.',
    'latin.ye.positional': '“ye” at a word start, after a vowel or after the tutuq sign became е.',
    'latin.tse.ambiguous': '“ts” was read as Cyrillic ц, but it could be тс.',
    'latin.shcha.ambiguous': '“şç” was read as Cyrillic щ, but it could be шч.',
    'latin.iotated': '“yo”, “yu” and “ya” were read as one Cyrillic letter (ё, ю, я).',
    'latin.tutuq.ambiguous': 'The tutuq sign was read as ъ; it could be ь or nothing.',
    'latin.c.ambiguous': 'A standalone c was read as Cyrillic ц.',
  },
};

const EXAMPLES: Record<string, string> = {
  old: 'Oʻzbekiston Respublikasi — mustaqil, demokratik davlat. Shahar markazida choyxona bor.',
  cyr: 'Ўзбекистон Республикаси — мустақил, демократик давлат. Шаҳар марказида чойхона бор.',
  tutuq: 'Isʼhoq va asʼhob soʻzlaridagi tutuq belgisi saqlanadi.',
};

// Inputs above this size wait for a pause in typing before converting.
const LARGE_INPUT = 100_000;
// Show the busy indicator only when a conversion is noticeably slow.
const BUSY_DELAY_MS = 150;

const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;
const input = $<HTMLTextAreaElement>('input');
const output = $<HTMLTextAreaElement>('output');
const fromSelect = $<HTMLSelectElement>('from');
const toSelect = $<HTMLSelectElement>('to');
const detected = $('detected');
const status = $('status');
const protectSpans = $<HTMLInputElement>('protectSpans');
const protectedTerms = $<HTMLInputElement>('protectedTerms');
const reviewList = $('reviewList');
const reviewEmpty = $('reviewEmpty');
const reviewCount = $('reviewCount');

let lang: Lang = readStored('alifbo.lang') === 'en' ? 'en' : 'uz';
let latest: ConvertResponse | undefined;
let requestId = 0;
let debounce = 0;
let busyTimer = 0;

function readStored(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function store(key: string, value: string): void {
  try {
    localStorage.setItem(key, value);
  } catch {
    // Storage can be unavailable (private mode); preferences are optional.
  }
}

function t(key: Key): string {
  return STRINGS[lang][key];
}

function applyLanguage(): void {
  document.documentElement.lang = lang;
  for (const element of document.querySelectorAll<HTMLElement>('[data-i18n]')) {
    element.textContent = t(element.dataset.i18n as Key);
  }
  for (const element of document.querySelectorAll<HTMLElement>('[data-i18n-title]')) {
    element.title = t(element.dataset.i18nTitle as Key);
  }
  for (const button of document.querySelectorAll<HTMLButtonElement>('[data-lang]')) {
    button.setAttribute('aria-pressed', String(button.dataset.lang === lang));
  }
  input.placeholder = t('placeholder');
  if (latest) render(latest);
}

function options(): ConversionOptions {
  const terms = protectedTerms.value
    .split(',')
    .map((term) => term.trim())
    .filter(Boolean);
  return { protectSpans: protectSpans.checked, protectedTerms: terms };
}

// Conversion runs in a worker so long documents never freeze typing or scrolling. If workers
// are unavailable (very old browsers), fall back to converting on the main thread.
let worker: Worker | undefined;
try {
  worker = new Worker(new URL('./worker.js', import.meta.url), { type: 'module' });
  worker.addEventListener('message', (event: MessageEvent<ConvertResponse>) => {
    receive(event.data);
  });
  worker.addEventListener('error', () => {
    worker = undefined;
    update();
  });
} catch {
  worker = undefined;
}

function update(): void {
  clearTimeout(debounce);
  requestId += 1;
  const request: ConvertRequest = {
    id: requestId,
    text: input.value,
    from: fromSelect.value as Source | 'auto',
    to: toSelect.value as Target,
    options: options(),
  };
  clearTimeout(busyTimer);
  busyTimer = window.setTimeout(() => {
    status.textContent = t('working');
    output.classList.add('stale');
  }, BUSY_DELAY_MS);
  if (worker) worker.postMessage(request);
  else receive(run(request));
}

function scheduleUpdate(): void {
  clearTimeout(debounce);
  debounce = window.setTimeout(update, input.value.length > LARGE_INPUT ? 300 : 0);
}

function receive(response: ConvertResponse): void {
  // A newer request is already on its way; drop this stale result.
  if (response.id !== requestId) return;
  clearTimeout(busyTimer);
  status.textContent = '';
  output.classList.remove('stale');
  latest = response;
  if (output.value !== response.text) output.value = response.text;
  render(response);
}

function render(response: ConvertResponse): void {
  $('inCount').textContent = response.inputChars
    ? `${response.inputChars.toLocaleString()} ${t('chars')}`
    : '';
  $('outCount').textContent = response.outputChars
    ? `${response.outputChars.toLocaleString()} ${t('chars')}`
    : '';
  const source = response.source;
  detected.textContent =
    fromSelect.value === 'auto' && response.inputChars > 0
      ? t('detected') +
        t(source === 'cyrillic' ? 'cyrillic' : source === 'new-latin' ? 'newLatin' : 'oldLatin')
      : '';

  reviewList.replaceChildren();
  reviewEmpty.hidden = response.warningCount > 0 || response.inputChars === 0;
  reviewCount.textContent = response.warningCount ? response.warningCount.toLocaleString() : '';

  for (const group of response.groups) {
    const card = document.createElement('article');
    card.className = 'group';
    const explanation = document.createElement('p');
    explanation.textContent = RULES[lang][group.key] ?? group.message;
    card.append(explanation);

    const words = document.createElement('div');
    words.className = 'words';
    for (const word of group.words) {
      const chip = document.createElement('span');
      chip.className = 'word';
      const mark = document.createElement('mark');
      mark.textContent = word.hit || '·';
      chip.append(word.before, mark, word.after);
      if (word.count > 1) {
        const small = document.createElement('small');
        small.textContent = `×${word.count.toLocaleString()}`;
        chip.append(small);
      }
      words.append(chip);
    }
    if (group.distinctWords > WORDS_PER_GROUP) {
      const more = document.createElement('span');
      more.className = 'word muted';
      more.textContent = `+${(group.distinctWords - WORDS_PER_GROUP).toLocaleString()}`;
      words.append(more);
    }
    card.append(words);

    const shown = group.alternatives.map((alternative) => alternative || '∅');
    if (shown.length) {
      const alts = document.createElement('div');
      alts.className = 'alts';
      alts.textContent = t('alternatives') + shown.join(' / ');
      card.append(alts);
    }
    reviewList.append(card);
  }
}

input.addEventListener('input', scheduleUpdate);
protectedTerms.addEventListener('input', scheduleUpdate);
protectSpans.addEventListener('change', update);
fromSelect.addEventListener('change', update);
toSelect.addEventListener('change', () => {
  store('alifbo.to', toSelect.value);
  update();
});

$('swap').addEventListener('click', () => {
  const currentFrom = latest?.source ?? 'old-latin';
  const currentTo = toSelect.value;
  input.value = output.value;
  fromSelect.value = currentTo;
  toSelect.value = currentFrom;
  store('alifbo.to', toSelect.value);
  update();
});

$('clear').addEventListener('click', () => {
  input.value = '';
  update();
  input.focus();
});

const copyButton = $<HTMLButtonElement>('copy');
copyButton.addEventListener('click', async () => {
  try {
    await navigator.clipboard.writeText(output.value);
  } catch {
    output.select();
    document.execCommand('copy');
  }
  copyButton.textContent = t('copied');
  setTimeout(() => (copyButton.textContent = t('copy')), 1500);
});

$('download').addEventListener('click', () => {
  const blob = new Blob([output.value], { type: 'text/plain;charset=utf-8' });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = `alifbo-${toSelect.value}.txt`;
  link.click();
  setTimeout(() => URL.revokeObjectURL(link.href), 1000);
});

$<HTMLInputElement>('file').addEventListener('change', async (event) => {
  const picker = event.target as HTMLInputElement;
  const file = picker.files?.[0];
  if (!file) return;
  input.value = await file.text();
  picker.value = '';
  update();
});

for (const chip of document.querySelectorAll<HTMLButtonElement>('[data-example]')) {
  chip.addEventListener('click', () => {
    input.value = EXAMPLES[chip.dataset.example!] ?? '';
    fromSelect.value = 'auto';
    update();
  });
}

for (const button of document.querySelectorAll<HTMLButtonElement>('[data-lang]')) {
  button.addEventListener('click', () => {
    lang = button.dataset.lang === 'en' ? 'en' : 'uz';
    store('alifbo.lang', lang);
    applyLanguage();
  });
}

// Only the target is remembered: a remembered source would silently mismatch newly pasted text.
const savedTo = readStored('alifbo.to');
if (savedTo && [...toSelect.options].some((option) => option.value === savedTo)) {
  toSelect.value = savedTo;
}
if (!input.value) input.value = EXAMPLES.old!;
applyLanguage();
update();
