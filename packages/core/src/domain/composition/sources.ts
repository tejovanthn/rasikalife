// Browser-safe. A composition credits every site it draws on as a plain URL list; what a
// link *is* (a lyrics page, a notation, a class recording) is read from the URL itself, so
// the list stays a pipe-joined column in the admin CSV.

export type SourceKind = 'page' | 'notation' | 'audio' | 'video';

export interface SourceDescription {
  url: string;
  /** Who to credit: the site, or its author where the site is one person's work. */
  site: string;
  kind: SourceKind;
  /** Link text, e.g. "Notation (PDF)" or "Class recording (MP3)". */
  label: string;
}

const SITE_NAMES: Record<string, string> = {
  'karnatik.com': 'karnatik.com',
  'shivkumar.org': 'Shivkumar Kalyanaraman (shivkumar.org)',
  'youtube.com': 'YouTube',
  'youtu.be': 'YouTube',
  'sangeetham.com': 'sangeetham.com',
};

function hostOf(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, '').toLowerCase();
  } catch {
    return url;
  }
}

export function describeSource(url: string): SourceDescription {
  const host = hostOf(url);
  const site = SITE_NAMES[host] ?? host;
  const path = url.toLowerCase().split(/[?#]/)[0] ?? '';

  if (host === 'youtube.com' || host === 'youtu.be') {
    return { url, site, kind: 'video', label: 'Video' };
  }
  if (/\.(mp3|m4a|mp4|ram)$/.test(path)) {
    return { url, site, kind: 'audio', label: `Class recording (${extensionOf(path)})` };
  }
  if (host === 'shivkumar.org' && /\.(pdf|html?|docx?)$/.test(path)) {
    return { url, site, kind: 'notation', label: `Notation (${extensionOf(path)})` };
  }
  return { url, site, kind: 'page', label: site };
}

function extensionOf(path: string): string {
  const ext = path.slice(path.lastIndexOf('.') + 1);
  return ext === 'htm' || ext === 'html' ? 'HTML' : ext.toUpperCase();
}

/** One link however it is written: http/https, `www.` and a trailing slash ignored. */
export function sourceKey(url: string): string {
  return url
    .trim()
    .replace(/^https?:\/\//i, '')
    .replace(/^www\./i, '')
    .replace(/\/$/, '')
    .toLowerCase();
}

/** Appends `extra` to `existing`, dropping repeats by `sourceKey`. */
export function mergeSources(existing: readonly string[], extra: readonly string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const url of [...existing, ...extra]) {
    const k = sourceKey(url);
    if (!k || seen.has(k)) continue;
    seen.add(k);
    out.push(url.trim());
  }
  return out;
}

/** `sources`, falling back to the legacy single `sourceAttribution` on unmigrated rows. */
export function sourcesOf(record: {
  sources?: string[] | null;
  sourceAttribution?: string | null;
}) {
  if (record.sources && record.sources.length > 0) return record.sources;
  return record.sourceAttribution ? [record.sourceAttribution] : [];
}
