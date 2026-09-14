import type { ConversionOptions } from '../src/index.js';
import { readDocx, type DocxDocument } from './docx.js';
import {
  run,
  runDocx,
  WORDS_PER_GROUP,
  type ConvertResponse,
  type Source,
  type Target,
} from './engine.js';
import type { WorkerRequest } from './worker.js';

type Lang = 'uz' | 'en' | 'ru';
const LANGS: readonly Lang[] = ['uz', 'en', 'ru'];

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
    formats:
      'Fayllar: .docx (Word), .txt, .md, .csv, .srt. PDF va eski .doc ochilmaydi, avval Word’da .docx qilib saqlang.',
    fileNote: 'Formatlash saqlanadi. Natijani .docx qilib yuklab oling.',
    closeFile: 'Yopish',
    downloadDocx: 'Yuklab olish (.docx)',
    unsupported: 'Bu fayl turi qoʻllab-quvvatlanmaydi.',
    badDocx:
      'Word faylni ochib boʻlmadi. U buzilgan yoki parol bilan himoyalangan boʻlishi mumkin.',
    placeholder: 'Matnni yozing, joylashtiring yoki faylni shu yerga tashlang…',
    chars: 'belgi',
    options: 'Sozlamalar',
    protectSpans: 'Havolalar, email manzillar va `kod` qismlarini oʻzgartirmaslik',
    protectedTerms: 'Oʻzgartirilmaydigan soʻzlar (vergul bilan):',
    review: 'Tekshirib chiqing',
    reviewEmpty: 'Hammasi aniq: tekshiradigan joy yoʻq.',
    alternatives: 'Boshqa variantlar: ',
    devTitle: 'Dasturchilar uchun',
    devText:
      'Bu sahifa ochiq kodli alifbo kutubxonasida ishlaydi. Uni TypeScript yoki Python loyihangizga ulang.',
    report: 'Xato haqida xabar berish',
    madeBy: 'Muallif:',
    legal:
      'Senat yangi alifbo haqidagi qonunni 2026-yil 10-sentabrda maʼqulladi. Rasmiy matn lex.uz saytida eʼlon qilinishi bilan qoidalar yangilanadi. Muhim hujjatlarni har doim tekshirib chiqing.',
    eyebrow: 'Yangi alifbo · 2026',
    tabText: 'Matn',
    tabDoc: 'Hujjat',
    dropTitle: 'Word yoki matn faylini shu yerga tashlang',
    chooseFile: 'Fayl tanlash',
    themeToDark: 'Tungi rejim',
    themeToLight: 'Kunduzgi rejim',
    detCyrillic: 'Kirill',
    detOldLatin: 'amaldagi lotin',
    detNewLatin: 'yangi lotin',
    featurePrivateTitle: 'Fayl yuklanmaydi',
    featurePrivateText:
      'Oʻgirish toʻliq brauzeringizda boʻladi. Matn va hujjatlar hech qayerga yuborilmaydi, roʻyxatdan oʻtish shart emas.',
    featureDocTitle: 'Formatlash saqlanadi',
    featureDocText:
      'Word hujjatdagi sarlavha, qalin matn, jadval va kolontitullar oʻz holicha qoladi.',
    featureReviewTitle: 'Noaniq joylar koʻrsatiladi',
    featureReviewText:
      'Kirilldagi е/э yoki ц kabi joylarda dastur taxmin qilmaydi, balki tekshirish uchun alohida koʻrsatadi.',
    copiedCommand: 'Nusxa olindi',
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
    formats:
      'Files: .docx (Word), .txt, .md, .csv, .srt. PDF and old .doc files aren’t supported; save them as .docx in Word first.',
    fileNote: 'Formatting is kept. Download the result as .docx.',
    closeFile: 'Close',
    downloadDocx: 'Download .docx',
    unsupported: 'This file type isn’t supported.',
    badDocx: 'Couldn’t open this Word file. It may be damaged or password-protected.',
    placeholder: 'Type or paste Uzbek text, or drop a file here…',
    chars: 'chars',
    options: 'Options',
    protectSpans: 'Leave links, email addresses and `code` unchanged',
    protectedTerms: 'Words to leave unchanged (comma-separated):',
    review: 'Review these',
    reviewEmpty: 'All clear: nothing to review.',
    alternatives: 'Alternatives: ',
    devTitle: 'For developers',
    devText:
      'This page runs on alifbo, an open-source library. Use the same engine in your TypeScript or Python project.',
    report: 'Report a problem',
    madeBy: 'Made by',
    legal:
      'Uzbekistan’s Senate approved the new alphabet law on 10 September 2026. Rules will be updated once the official text is published on lex.uz. Always proofread important documents.',
    eyebrow: 'New alphabet · 2026',
    tabText: 'Text',
    tabDoc: 'Document',
    dropTitle: 'Drop a Word or text file here',
    chooseFile: 'Choose file',
    themeToDark: 'Dark mode',
    themeToLight: 'Light mode',
    detCyrillic: 'Cyrillic',
    detOldLatin: 'current Latin',
    detNewLatin: 'new Latin',
    featurePrivateTitle: 'Nothing is uploaded',
    featurePrivateText:
      'Conversion happens entirely in your browser. Text and documents are never sent anywhere, and there is no sign-up.',
    featureDocTitle: 'Formatting stays intact',
    featureDocText:
      'Headings, bold text, tables, headers and footers in Word documents stay exactly as they were.',
    featureReviewTitle: 'Uncertain spots are flagged',
    featureReviewText:
      'Where Cyrillic is ambiguous, like е/э or ц, alifbo doesn’t guess silently. It lists them for you to check.',
    copiedCommand: 'Copied',
  },
  ru: {
    title: 'Переводите узбекский текст на новый латинский алфавит',
    subtitle:
      'Между кириллицей, действующей латиницей и новой латиницей 2026 года. Спорные места отмечаются для проверки.',
    from: 'Исходный алфавит',
    to: 'Перевести в',
    auto: 'Определить автоматически',
    cyrillic: 'Кириллица',
    oldLatin: 'Действующая латиница (oʻ, gʻ, sh, ch)',
    newLatin: 'Новая латиница (ö, ğ, ş, ç)',
    swap: 'Поменять местами',
    detected: 'Определено: ',
    input: 'Текст',
    output: 'Результат',
    openFile: 'Открыть файл',
    clear: 'Очистить',
    copy: 'Копировать',
    copied: 'Скопировано ✓',
    download: 'Скачать',
    tryExample: 'Пример:',
    privacy: 'Текст не покидает ваш браузер.',
    working: 'Конвертация…',
    formats:
      'Файлы: .docx (Word), .txt, .md, .csv, .srt. PDF и старые .doc не поддерживаются — сначала сохраните их в Word как .docx.',
    fileNote: 'Форматирование сохраняется. Скачайте результат в формате .docx.',
    closeFile: 'Закрыть',
    downloadDocx: 'Скачать .docx',
    unsupported: 'Этот тип файла не поддерживается.',
    badDocx: 'Не удалось открыть файл Word. Возможно, он повреждён или защищён паролем.',
    placeholder: 'Введите или вставьте узбекский текст либо перетащите файл сюда…',
    chars: 'симв.',
    options: 'Настройки',
    protectSpans: 'Не изменять ссылки, адреса email и `код`',
    protectedTerms: 'Слова, которые не нужно менять (через запятую):',
    review: 'Проверьте',
    reviewEmpty: 'Всё однозначно: проверять нечего.',
    alternatives: 'Варианты: ',
    devTitle: 'Для разработчиков',
    devText:
      'Страница работает на открытой библиотеке alifbo. Подключите тот же движок в свой проект на TypeScript или Python.',
    report: 'Сообщить об ошибке',
    madeBy: 'Автор:',
    legal:
      'Сенат Узбекистана одобрил закон о новом алфавите 10 сентября 2026 года. Правила обновятся после публикации официального текста на lex.uz. Всегда проверяйте важные документы.',
    eyebrow: 'Новый алфавит · 2026',
    tabText: 'Текст',
    tabDoc: 'Документ',
    dropTitle: 'Перетащите сюда файл Word или текстовый файл',
    chooseFile: 'Выбрать файл',
    themeToDark: 'Тёмная тема',
    themeToLight: 'Светлая тема',
    detCyrillic: 'кириллица',
    detOldLatin: 'действующая латиница',
    detNewLatin: 'новая латиница',
    featurePrivateTitle: 'Файлы не загружаются',
    featurePrivateText:
      'Конвертация идёт полностью в браузере. Текст и документы никуда не отправляются, регистрация не нужна.',
    featureDocTitle: 'Форматирование сохраняется',
    featureDocText:
      'Заголовки, жирный текст, таблицы и колонтитулы в документах Word остаются без изменений.',
    featureReviewTitle: 'Спорные места отмечены',
    featureReviewText:
      'Там, где кириллица неоднозначна (е/э, ц), alifbo не угадывает молча, а показывает эти места для проверки.',
    copiedCommand: 'Скопировано',
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
  ru: {
    'cyrillic.e.positional':
      'е записана как «ye» в начале слова и после гласной, в остальных случаях как «e». Особенно проверьте заимствованные слова.',
    'cyrillic.tse.positional': 'ц записана как «s» в начале слова и как «ts» в остальных случаях.',
    'cyrillic.shcha.ambiguous': 'У щ нет точного соответствия в новой латинице; выбрано «şç».',
    'cyrillic.hard-sign.ambiguous': 'Твёрдый знак ъ записан как знак тутук ʼ.',
    'cyrillic.soft-sign.ambiguous': 'Мягкий знак ь опущен.',
    'cyrillic.compound': 'ё, ю и я записаны двумя буквами (yo, yu, ya).',
    'latin.e.ambiguous':
      'Латинская e записана как э в начале слова и после гласной, в остальных случаях как е. Особенно проверьте заимствованные слова.',
    'latin.ye.positional': '«ye» в начале слова, после гласной или знака тутук записано как е.',
    'latin.tse.ambiguous': '«ts» прочитано как ц, но это может быть тс.',
    'latin.shcha.ambiguous': '«şç» прочитано как щ, но это может быть шч.',
    'latin.iotated': '«yo», «yu» и «ya» прочитаны как одна буква (ё, ю, я).',
    'latin.tutuq.ambiguous': 'Знак тутук прочитан как ъ; это может быть ь или ничего.',
    'latin.c.ambiguous': 'Отдельная c прочитана как ц.',
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
const TEXT_EXTENSIONS = ['.txt', '.md', '.csv', '.srt'];
const DOCX_TYPE = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';

type Mode = 'text' | 'doc';
type Theme = 'light' | 'dark';
type Response = ConvertResponse & { bytes?: Uint8Array };
type WorkerMessage =
  | ({ type: 'result' } & Response)
  | { type: 'docx-loaded'; id: number; text: string }
  | { type: 'error'; id: number; message: string };

const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;
const root = document.documentElement;
const input = $<HTMLTextAreaElement>('input');
const output = $<HTMLTextAreaElement>('output');
const fromSelect = $<HTMLSelectElement>('from');
const toSelect = $<HTMLSelectElement>('to');
const detected = $('detected');
const status = $('status');
const notice = $('notice');
const fileBanner = $('fileBanner');
const dropzone = $('dropzone');
const dropOverlay = $('dropOverlay');
const panes = $('panes');
const converter = $('converter');
const inputPane = $('inputPane');
const review = $('review');
const swapButton = $<HTMLButtonElement>('swap');
const copyButton = $<HTMLButtonElement>('copy');
const downloadButton = $<HTMLButtonElement>('download');
const themeButton = $<HTMLButtonElement>('theme');
const protectSpans = $<HTMLInputElement>('protectSpans');
const protectedTerms = $<HTMLInputElement>('protectedTerms');
const reviewList = $('reviewList');
const reviewEmpty = $('reviewEmpty');
const reviewCount = $('reviewCount');

let lang: Lang = initialLanguage();
let mode: Mode = 'text';
let latest: Response | undefined;
let requestId = 0;
let debounce = 0;
let busyTimer = 0;
/** Set while a Word document is open; conversion then rewrites the document itself. */
let docx: { name: string; pendingId: number; loaded: boolean } | undefined;
/** Main-thread copy of the document, used only when workers are unavailable. */
let localDoc: DocxDocument | undefined;

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

function initialLanguage(): Lang {
  const saved = readStored('alifbo.lang');
  if (saved && (LANGS as readonly string[]).includes(saved)) return saved as Lang;
  const browser = (navigator.language || '').slice(0, 2);
  return browser === 'ru' ? 'ru' : browser === 'en' ? 'en' : 'uz';
}

function t(key: Key): string {
  return STRINGS[lang][key];
}

// ---------- Theme ----------
// With no saved choice the page follows the system setting (CSS handles that); the button
// stores an explicit choice, which the inline script in <head> applies before first paint.
const systemDark = window.matchMedia('(prefers-color-scheme: dark)');

function resolvedTheme(): Theme {
  const chosen = root.dataset.theme;
  if (chosen === 'light' || chosen === 'dark') return chosen;
  return systemDark.matches ? 'dark' : 'light';
}

function syncTheme(): void {
  const theme = resolvedTheme();
  root.dataset.resolvedTheme = theme;
  const label = theme === 'dark' ? t('themeToLight') : t('themeToDark');
  themeButton.title = label;
  themeButton.setAttribute('aria-label', label);
  const color = getComputedStyle(root).getPropertyValue('--bg').trim();
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', color);
}

themeButton.addEventListener('click', () => {
  const next: Theme = resolvedTheme() === 'dark' ? 'light' : 'dark';
  root.dataset.theme = next;
  store('alifbo.theme', next);
  syncTheme();
});
systemDark.addEventListener('change', syncTheme);

// ---------- Language ----------
function applyLanguage(): void {
  root.lang = lang;
  for (const element of document.querySelectorAll<HTMLElement>('[data-i18n]')) {
    element.textContent = t(element.dataset.i18n as Key);
  }
  for (const element of document.querySelectorAll<HTMLElement>('[data-i18n-title]')) {
    const label = t(element.dataset.i18nTitle as Key);
    element.title = label;
    element.setAttribute('aria-label', label);
  }
  for (const button of document.querySelectorAll<HTMLButtonElement>('[data-lang]')) {
    button.setAttribute('aria-pressed', String(button.dataset.lang === lang));
  }
  input.placeholder = t('placeholder');
  input.setAttribute('aria-label', t('input'));
  output.setAttribute('aria-label', t('output'));
  $('copyLabel').textContent = t('copy');
  $('downloadLabel').textContent = docx ? t('downloadDocx') : t('download');
  if (notice.dataset.key) notice.textContent = t(notice.dataset.key as Key);
  syncTheme();
  if (latest) render(latest);
}

function options(): ConversionOptions {
  const terms = protectedTerms.value
    .split(',')
    .map((term) => term.trim())
    .filter(Boolean);
  return { protectSpans: protectSpans.checked, protectedTerms: terms };
}

function showNotice(key: Key | undefined): void {
  notice.dataset.key = key ?? '';
  notice.textContent = key ? t(key) : '';
  notice.hidden = key === undefined;
}

/** Grow a text box with its content, within the min and max heights set in CSS. */
function autosize(area: HTMLTextAreaElement): void {
  area.style.height = 'auto';
  area.style.height = `${area.scrollHeight + 2}px`;
}

function autosizeBoth(): void {
  // Side-by-side panes share one row, so size both to the taller content.
  autosize(input);
  autosize(output);
  if (window.matchMedia('(min-width: 861px)').matches) {
    const height = Math.max(input.offsetHeight, output.offsetHeight);
    input.style.height = output.style.height = `${height}px`;
  }
}

// ---------- Conversion ----------
// Conversion runs in a worker so long documents never freeze typing or scrolling. If workers
// are unavailable (very old browsers), fall back to converting on the main thread.
let worker: Worker | undefined;
try {
  worker = new Worker(new URL('./worker.js', import.meta.url), { type: 'module' });
  worker.addEventListener('message', (event: MessageEvent<WorkerMessage>) => {
    const message = event.data;
    if (message.type === 'result') receive(message);
    else if (message.type === 'docx-loaded') docxLoaded(message.id, message.text);
    else failed(message.id);
  });
  worker.addEventListener('error', () => {
    worker = undefined;
    if (docx) closeDocx();
    update();
  });
} catch {
  worker = undefined;
}

function send(request: WorkerRequest, transfer: Transferable[] = []): void {
  if (worker) {
    worker.postMessage(request, transfer);
    return;
  }
  try {
    if (request.type === 'text') receive(run(request));
    else if (request.type === 'docx-load') {
      localDoc = readDocx(request.buffer);
      docxLoaded(request.id, localDoc.text);
    } else if (request.type === 'docx' && localDoc) receive(runDocx(localDoc, request));
    else if (request.type === 'docx-close') localDoc = undefined;
  } catch {
    failed('id' in request ? request.id : 0);
  }
}

function update(): void {
  clearTimeout(debounce);
  if (mode === 'doc' && !docx?.loaded) return;
  requestId += 1;
  const base = {
    id: requestId,
    from: fromSelect.value as Source | 'auto',
    to: toSelect.value as Target,
    options: options(),
  };
  clearTimeout(busyTimer);
  busyTimer = window.setTimeout(() => {
    status.textContent = t('working');
    output.classList.add('stale');
  }, BUSY_DELAY_MS);
  send(docx ? { type: 'docx', ...base } : { type: 'text', text: input.value, ...base });
}

function scheduleUpdate(): void {
  clearTimeout(debounce);
  autosizeBoth();
  debounce = window.setTimeout(update, input.value.length > LARGE_INPUT ? 300 : 0);
}

function receive(response: Response): void {
  // A newer request is already on its way; drop this stale result.
  if (response.id !== requestId) return;
  clearTimeout(busyTimer);
  status.textContent = '';
  output.classList.remove('stale');
  latest = response;
  if (output.value !== response.text) output.value = response.text;
  autosizeBoth();
  render(response);
}

function failed(id: number): void {
  clearTimeout(busyTimer);
  status.textContent = '';
  output.classList.remove('stale');
  if (docx && id === docx.pendingId) {
    closeDocx();
    setMode('doc');
    showNotice('badDocx');
  }
}

// ---------- Modes and files ----------
/** Show the text editor, or the document drop zone until a document is open. */
function setMode(next: Mode): void {
  mode = next;
  for (const tab of document.querySelectorAll<HTMLButtonElement>('[data-mode]')) {
    tab.setAttribute('aria-selected', String(tab.dataset.mode === mode));
  }
  const waitingForFile = mode === 'doc' && !docx;
  converter.toggleAttribute('data-doc-open', Boolean(docx));
  dropzone.hidden = !waitingForFile;
  panes.hidden = waitingForFile;
  review.hidden = waitingForFile;
  if (waitingForFile) {
    detected.textContent = '';
    status.textContent = '';
  }
}

async function openFile(file: File): Promise<void> {
  showNotice(undefined);
  const name = file.name.toLowerCase();
  if (name.endsWith('.docx') || file.type === DOCX_TYPE) {
    if (docx) closeDocx();
    requestId += 1;
    docx = { name: file.name, pendingId: requestId, loaded: false };
    const buffer = await file.arrayBuffer();
    send({ type: 'docx-load', id: docx.pendingId, buffer }, [buffer]);
    return;
  }
  if (
    TEXT_EXTENSIONS.some((extension) => name.endsWith(extension)) ||
    file.type.startsWith('text/')
  ) {
    if (docx) closeDocx();
    setMode('text');
    input.value = await file.text();
    autosizeBoth();
    update();
    return;
  }
  showNotice('unsupported');
}

function docxLoaded(id: number, text: string): void {
  if (!docx || id !== docx.pendingId) return;
  docx.loaded = true;
  input.value = text;
  input.readOnly = true;
  swapButton.disabled = true;
  $('fileName').textContent = docx.name;
  fileBanner.hidden = false;
  $('downloadLabel').textContent = t('downloadDocx');
  setMode('doc');
  update();
}

function closeDocx(): void {
  if (!docx) return;
  docx = undefined;
  send({ type: 'docx-close' });
  input.readOnly = false;
  swapButton.disabled = false;
  fileBanner.hidden = true;
  $('downloadLabel').textContent = t('download');
  input.value = '';
  output.value = '';
  latest = undefined;
}

// ---------- Rendering ----------
function sourceName(source: Source): string {
  return t(
    source === 'cyrillic' ? 'detCyrillic' : source === 'new-latin' ? 'detNewLatin' : 'detOldLatin',
  );
}

function render(response: Response): void {
  $('inCount').textContent = response.inputChars
    ? `${response.inputChars.toLocaleString()} ${t('chars')}`
    : '';
  $('outCount').textContent = response.outputChars
    ? `${response.outputChars.toLocaleString()} ${t('chars')}`
    : '';
  detected.textContent =
    fromSelect.value === 'auto' && response.inputChars > 0 ? sourceName(response.source) : '';

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

// ---------- Events ----------
input.addEventListener('input', scheduleUpdate);
protectedTerms.addEventListener('input', scheduleUpdate);
protectSpans.addEventListener('change', update);
fromSelect.addEventListener('change', update);
toSelect.addEventListener('change', () => {
  store('alifbo.to', toSelect.value);
  update();
});
window.addEventListener('resize', autosizeBoth);

for (const tab of document.querySelectorAll<HTMLButtonElement>('[data-mode]')) {
  tab.addEventListener('click', () => {
    const next = tab.dataset.mode === 'doc' ? 'doc' : 'text';
    if (next === mode) return;
    showNotice(undefined);
    if (next === 'text' && docx) {
      closeDocx();
      input.value = '';
    }
    setMode(next);
    if (next === 'text') {
      autosizeBoth();
      update();
      input.focus();
    }
  });
}

swapButton.addEventListener('click', () => {
  const currentFrom = latest?.source ?? 'old-latin';
  const currentTo = toSelect.value;
  input.value = output.value;
  fromSelect.value = currentTo;
  toSelect.value = currentFrom;
  store('alifbo.to', toSelect.value);
  autosizeBoth();
  update();
});

$('clear').addEventListener('click', () => {
  showNotice(undefined);
  input.value = '';
  autosizeBoth();
  update();
  input.focus();
});

$('closeFile').addEventListener('click', () => {
  closeDocx();
  setMode('doc');
});

async function copyText(text: string): Promise<void> {
  try {
    await navigator.clipboard.writeText(text);
  } catch {
    const area = document.createElement('textarea');
    area.value = text;
    document.body.append(area);
    area.select();
    document.execCommand('copy');
    area.remove();
  }
}

copyButton.addEventListener('click', async () => {
  await copyText(output.value);
  copyButton.classList.add('copied');
  $('copyLabel').textContent = t('copied');
  setTimeout(() => {
    copyButton.classList.remove('copied');
    $('copyLabel').textContent = t('copy');
  }, 1600);
});

for (const command of document.querySelectorAll<HTMLButtonElement>('[data-copy]')) {
  command.addEventListener('click', async () => {
    await copyText(command.dataset.copy ?? '');
    command.classList.add('copied');
    command.title = t('copiedCommand');
    setTimeout(() => command.classList.remove('copied'), 1600);
  });
}

function save(blob: Blob, filename: string): void {
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = filename;
  link.click();
  setTimeout(() => URL.revokeObjectURL(link.href), 1000);
}

downloadButton.addEventListener('click', () => {
  if (docx && latest?.bytes) {
    const base = docx.name.replace(/\.docx$/i, '');
    save(
      new Blob([latest.bytes as Uint8Array<ArrayBuffer>], { type: DOCX_TYPE }),
      `${base}-${toSelect.value}.docx`,
    );
    return;
  }
  save(
    new Blob([output.value], { type: 'text/plain;charset=utf-8' }),
    `alifbo-${toSelect.value}.txt`,
  );
});

for (const picker of document.querySelectorAll<HTMLInputElement>('.file-input')) {
  picker.addEventListener('change', async () => {
    const file = picker.files?.[0];
    picker.value = '';
    if (file) await openFile(file);
  });
}

// Files can be dropped anywhere on the page; an overlay confirms the drop target.
let dragDepth = 0;
const hasFiles = (event: DragEvent) => [...(event.dataTransfer?.types ?? [])].includes('Files');
window.addEventListener('dragenter', (event) => {
  if (!hasFiles(event)) return;
  dragDepth += 1;
  dropOverlay.hidden = false;
});
window.addEventListener('dragover', (event) => {
  if (hasFiles(event)) event.preventDefault();
});
window.addEventListener('dragleave', (event) => {
  if (!hasFiles(event)) return;
  dragDepth = Math.max(0, dragDepth - 1);
  if (dragDepth === 0) dropOverlay.hidden = true;
});
window.addEventListener('drop', async (event) => {
  dragDepth = 0;
  dropOverlay.hidden = true;
  inputPane.classList.remove('dropping');
  const file = event.dataTransfer?.files[0];
  if (!file) return;
  event.preventDefault();
  await openFile(file);
});

for (const chip of document.querySelectorAll<HTMLButtonElement>('[data-example]')) {
  chip.addEventListener('click', () => {
    if (docx) closeDocx();
    showNotice(undefined);
    setMode('text');
    input.value = EXAMPLES[chip.dataset.example!] ?? '';
    fromSelect.value = 'auto';
    autosizeBoth();
    update();
  });
}

for (const button of document.querySelectorAll<HTMLButtonElement>('[data-lang]')) {
  button.addEventListener('click', () => {
    lang = (LANGS as readonly string[]).includes(button.dataset.lang ?? '')
      ? (button.dataset.lang as Lang)
      : 'uz';
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
setMode('text');
applyLanguage();
autosizeBoth();
update();
