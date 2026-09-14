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

import { sizeBucket, trackEvent, trackVisit } from './analytics.js';
import { LANGS, RULES, STRINGS, type Key, type Lang } from './i18n.js';

// Hashed worker file name, injected by scripts/build-site.mjs.
declare const __WORKER_URL__: string;

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
const review = $<HTMLDetailsElement>('review');
const swapButton = $<HTMLButtonElement>('swap');
const copyButton = $<HTMLButtonElement>('copy');
const downloadButton = $<HTMLButtonElement>('download');
const themeButton = $<HTMLButtonElement>('theme');
const protectSpans = $<HTMLInputElement>('protectSpans');
const protectedTerms = $<HTMLInputElement>('protectedTerms');
const reviewList = $('reviewList');
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
  trackEvent(`theme/${next}`);
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
  worker = new Worker(new URL(__WORKER_URL__, import.meta.url), { type: 'module' });
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
    trackEvent('docx-error');
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
  if (waitingForFile) review.hidden = true;
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
    trackEvent(`docx-open/${sizeBucket(file.size)}`);
    // Reading and unzipping a large document takes a moment; show the same busy state as conversion.
    status.textContent = t('working');
    output.classList.add('stale');
    const buffer = await file.arrayBuffer();
    send({ type: 'docx-load', id: docx.pendingId, buffer }, [buffer]);
    return;
  }
  if (
    TEXT_EXTENSIONS.some((extension) => name.endsWith(extension)) ||
    file.type.startsWith('text/')
  ) {
    if (docx) closeDocx();
    trackEvent(`text-file-open/${sizeBucket(file.size)}`);
    setMode('text');
    input.value = await file.text();
    autosizeBoth();
    update();
    return;
  }
  showNotice('unsupported');
  trackEvent('file-unsupported');
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
  // The review bar only appears when there is something to check.
  review.hidden = response.warningCount === 0 || (mode === 'doc' && !docx);
  if (review.hidden) review.open = false;
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

// ---------- Panels ----------
for (const trigger of document.querySelectorAll<HTMLButtonElement>('[data-dialog]')) {
  trigger.addEventListener('click', () => {
    const dialog = document.getElementById(
      trigger.dataset.dialog ?? '',
    ) as HTMLDialogElement | null;
    if (dialog && !dialog.open) dialog.showModal();
    trackEvent(`panel/${trigger.dataset.dialog}`);
  });
}
for (const dialog of document.querySelectorAll<HTMLDialogElement>('dialog.sheet')) {
  // A click on the backdrop lands on the dialog element itself, outside its content box.
  dialog.addEventListener('click', (event) => {
    const box = dialog.getBoundingClientRect();
    const outside =
      event.clientX < box.left ||
      event.clientX > box.right ||
      event.clientY < box.top ||
      event.clientY > box.bottom;
    if (event.target === dialog && outside) dialog.close();
  });
  for (const close of dialog.querySelectorAll<HTMLButtonElement>('[data-close]')) {
    close.addEventListener('click', () => dialog.close());
  }
}

// ---------- Events ----------
input.addEventListener('input', () => {
  trackEvent('text-typed');
  scheduleUpdate();
});
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
  trackEvent('swap');
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
  trackEvent(docx ? 'copy/docx' : 'copy/text');
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
    trackEvent(`install-copy/${(command.dataset.copy ?? '').split(' ')[0]}`);
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
  trackEvent(
    `download/${docx ? 'docx' : 'text'}/${latest?.source ?? 'unknown'}-to-${toSelect.value}`,
  );
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
    trackEvent(`example/${chip.dataset.example}`);
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
    trackEvent(`language/${lang}`);
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

review.addEventListener('toggle', () => {
  if (review.open) trackEvent('review-open');
});
trackVisit();
