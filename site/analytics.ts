// Anonymous usage counts via GoatCounter (https://www.goatcounter.com), which stores no IP
// addresses or cookies. Only counts are sent: a page visit, and the names of features used
// (for example "docx-open/100kb-1mb"). Converted text, file names and file contents never are.
//
// Counting runs only on the live site, and not when the browser asks not to be tracked.

const ENDPOINT = 'https://alifbo.goatcounter.com/count';
const LIVE_HOST = 'azakapro.github.io';

/** Each event is counted at most once per page load, so typing or re-converting adds nothing. */
const sent = new Set<string>();

function enabled(): boolean {
  if (location.hostname !== LIVE_HOST) return false;
  const nav = navigator as Navigator & { globalPrivacyControl?: boolean };
  return nav.doNotTrack !== '1' && nav.globalPrivacyControl !== true;
}

function send(params: Record<string, string>): void {
  const query = new URLSearchParams({ ...params, rnd: Math.random().toString(36).slice(2) });
  // An image request needs no script from GoatCounter and cannot read anything from the page.
  new Image().src = `${ENDPOINT}?${query}`;
}

/** The referring site's host only (e.g. "t.me"), never the full address someone came from. */
function referrerHost(): string {
  try {
    const host = new URL(document.referrer).hostname;
    return host === location.hostname ? '' : host;
  } catch {
    return '';
  }
}

/** Campaign tags like ?utm_source=telegram, and nothing else from the address. */
function campaign(): string {
  const tags = new URLSearchParams();
  for (const [key, value] of new URLSearchParams(location.search)) {
    if (key.startsWith('utm_')) tags.set(key, value.slice(0, 40));
  }
  return tags.toString();
}

export function trackVisit(): void {
  if (!enabled()) return;
  const params: Record<string, string> = {
    p: location.pathname,
    t: 'alifbo',
    s: `${screen.width},${screen.height},${devicePixelRatio}`,
  };
  const referrer = referrerHost();
  if (referrer) params.r = referrer;
  const tags = campaign();
  if (tags) params.q = tags;
  send(params);
}

export function trackEvent(name: string): void {
  if (!enabled() || sent.has(name)) return;
  sent.add(name);
  send({ p: name, t: name, e: 'true' });
}

/** Coarse size range for file events, so no file can be identified by its exact size. */
export function sizeBucket(bytes: number): string {
  if (bytes < 100_000) return 'under-100kb';
  if (bytes < 1_000_000) return '100kb-1mb';
  if (bytes < 10_000_000) return '1-10mb';
  return 'over-10mb';
}
