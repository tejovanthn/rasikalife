// Shapes and pure rules shared by every outside-source import (shivkumar.org first). Each
// source has an adapter that turns its archive into `SourceRecord`s; from there one
// pipeline matches, builds the admin CSV, applies it and, from the manifest the apply
// writes, undoes it. No I/O here, so the rules are tested.

import { mergeSources, sourceKey } from './sources';

/** One composition as an outside source holds it, before matching against ours. */
export interface SourceRecord {
  /** Stable within the source, e.g. the lesson's URL. Joins the review CSV to the record. */
  key: string;
  title: string;
  raga?: string;
  tala?: string;
  composer?: string;
  compositionType?: 'kriti' | 'varnam' | 'other';
  /** Links to credit on the composition: the source's own pages, recordings, credits. */
  sources: string[];
  notation?: string;
  lyrics: Array<{ type: string; order: number; text: string }>;
  /** The scale the source prints, when it does: lets one raga under two names match. */
  scale?: { arohanam?: string; avarohanam?: string };
  /** Anything the reviewer should see, e.g. where the text came from. */
  note?: string;
}

/** What one apply changed, so that it can be taken back, wholly or one song at a time. */
export interface ImportManifest {
  source: string;
  file: string;
  appliedAt: string;
  userId: string;
  attached: AttachedEntry[];
  created: Array<{ id: string; title: string; undoneAt?: string }>;
  /** Artists, ragas and talas a new name created along the way. */
  createdLinks: Array<{ domain: string; id: string; name: string; undoneAt?: string }>;
}

export interface AttachedEntry {
  id: string;
  title: string;
  /** Exactly the links this import added; links the record already held are not here. */
  addedSources: string[];
  /** Set when the import wrote the notation: a fingerprint of what it wrote. */
  notationFingerprint?: string;
  undoneAt?: string;
}

/**
 * A short fingerprint of a text (FNV-1a, plus the length). Lets undo tell whether the
 * notation is still what the import wrote, without keeping tens of kilobytes per song.
 */
export function textFingerprint(text: string): string {
  let hash = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return `${(hash >>> 0).toString(16).padStart(8, '0')}:${text.length}`;
}

/**
 * The write for one attach row, decided against the record as it stands at apply time
 * rather than when the CSV was built: links are merged into what is there now, and
 * notation is written only where none exists, so a person's edit is never overwritten.
 */
export function planAttach(
  current: { sources: string[]; notation?: string | null },
  incoming: { sources?: string[]; notation?: string }
): {
  patch: { sources?: string[]; notation?: string };
  entry: Omit<AttachedEntry, 'id' | 'title'>;
} {
  const merged = mergeSources(current.sources, incoming.sources ?? []);
  const have = new Set(current.sources.map(sourceKey));
  const addedSources = merged.filter(url => !have.has(sourceKey(url)));
  const writeNotation = Boolean(incoming.notation) && !current.notation;

  const patch: { sources?: string[]; notation?: string } = {};
  if (addedSources.length > 0) patch.sources = merged;
  if (writeNotation) patch.notation = incoming.notation;
  return {
    patch,
    entry: {
      addedSources,
      notationFingerprint: writeNotation ? textFingerprint(incoming.notation ?? '') : undefined,
    },
  };
}

/**
 * How to take one attach back. Removes only the links the import added, and the notation
 * only while it is still exactly what the import wrote: an edited notation is kept, and
 * said so, rather than lost.
 */
export function planAttachUndo(
  current: { sources: string[]; notation?: string | null },
  entry: AttachedEntry
): { sources?: string[]; clearNotation: boolean; keptEditedNotation: boolean } {
  const added = new Set(entry.addedSources.map(sourceKey));
  const remaining = current.sources.filter(url => !added.has(sourceKey(url)));
  const sourcesChanged = remaining.length !== current.sources.length;

  const imported = entry.notationFingerprint;
  const stillOurs = Boolean(
    imported && current.notation && textFingerprint(current.notation) === imported
  );
  return {
    sources: sourcesChanged ? remaining : undefined,
    clearNotation: stillOurs,
    keptEditedNotation: Boolean(imported && current.notation && !stillOurs),
  };
}
