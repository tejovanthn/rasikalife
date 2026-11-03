/**
 * The decisions behind `ssp-people-apply` and `ssp-people-undo`, pure so they can be tested.
 *
 * Create: a new record from one SSP person, with the searched spelling as `name` and the IAST
 * in `alternateNames`. Attach: a patch that fills only what the stored record leaves empty.
 * Scalar fields (years, places, mudra) are never overwritten; a stored value that differs is
 * held, not replaced. List fields (`gurus`, `works`, `alternateNames`) merge onto the stored
 * rows by name and never drop one: a form that rebuilds a list from its own fields loses every
 * key it does not render, so nothing here rebuilds. Citations merge the same way.
 *
 * Undo: put a field back only while it still holds what the import wrote, take out exactly
 * the list rows and citations the import added, and delete a created record only if nothing
 * links to it since.
 *
 * Field names are coded against the artist schema change that adds `deathYear`, `deathPlace`,
 * `isHistorical`, `mudra`, `alternateNames`, `citations` and the guru relationship
 * `spiritual`. The script checks each payload against `UpdateArtistSchema` before writing.
 */

import { isEmptyValue } from '../source/citations';
import type { StoredCitation } from '../source/citations';
import type { SspPerson, SspPersonCitation } from './ssp-people';
import { sspNameKey } from './ssp-people';

export const PEOPLE_SOURCE = 'published-source' as const;

// ── shapes ────────────────────────────────────────────────────────────────────────────────

export interface StoredGuru {
  id?: string;
  name: string;
  relationship?: string;
  source?: string;
  [key: string]: unknown;
}

export interface StoredWork {
  title: string;
  source?: string;
  [key: string]: unknown;
}

export interface SspStoredArtist {
  id: string;
  name: string;
  alternateNames?: string[] | null;
  gurus?: StoredGuru[] | null;
  works?: StoredWork[] | null;
  birthYear?: number | null;
  deathYear?: number | null;
  birthPlace?: string | null;
  deathPlace?: string | null;
  mudra?: string | null;
  isHistorical?: boolean | null;
  citations?: StoredCitation[] | null;
}

/** Who a guru is in our records: a stored or newly created artist. */
export type GuruResolver = (
  guruKey: string | undefined
) => { id: string; name: string } | undefined;

export interface PersonFieldChange {
  /** `null` when the field was empty. */
  before: unknown;
  after: unknown;
  /** List fields: the rows or strings this import added. */
  added?: unknown[];
  /** Guru rows that already existed and gained an `id`. */
  idFilled?: { name: string; id: string }[];
}

export interface SspHeldValue {
  field: string;
  value: unknown;
  reason: string;
}

export interface SspPersonAttachPlan {
  changes: Record<string, PersonFieldChange>;
  citationsAdded: StoredCitation[];
  /** The payload for the artist update path. */
  update: Record<string, unknown>;
  held: SspHeldValue[];
}

// ── comparing ─────────────────────────────────────────────────────────────────────────────

function canonical(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`;
  if (value && typeof value === 'object') {
    const entries = Object.entries(value as Record<string, unknown>)
      .filter(([, v]) => v !== undefined && v !== null)
      .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
    return `{${entries.map(([k, v]) => `${JSON.stringify(k)}:${canonical(v)}`).join(',')}}`;
  }
  return JSON.stringify(value ?? null);
}

export function sameValue(a: unknown, b: unknown): boolean {
  if (isEmptyValue(a) && isEmptyValue(b)) return true;
  return canonical(a) === canonical(b);
}

function plainKey(text: string): string {
  return text
    .normalize('NFKD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '');
}

/** Titles meet across spellings: `Prakāśikā` and `Prakashika`. */
function workKey(title: string): string {
  return sspNameKey(title).replace(/\s/g, '');
}

export function citationKey(c: Pick<StoredCitation, 'field' | 'sourceSlug' | 'locator' | 'note'>) {
  return [c.field, c.sourceSlug, c.locator, c.note ?? ''].join('\u0001');
}

export function mergeCitations(
  stored: readonly StoredCitation[] | null | undefined,
  incoming: readonly StoredCitation[]
): { merged: StoredCitation[]; added: StoredCitation[] } {
  const merged = [...(stored ?? [])];
  const seen = new Set(merged.map(citationKey));
  const added: StoredCitation[] = [];
  for (const c of incoming) {
    const key = citationKey(c);
    if (seen.has(key)) continue;
    seen.add(key);
    merged.push(c);
    added.push(c);
  }
  return { merged, added };
}

// ── create ────────────────────────────────────────────────────────────────────────────────

export interface SspPersonCreatePlan {
  /** The payload for `createArtist`. */
  input: Record<string, unknown>;
  citations: SspPersonCitation[];
}

/** The IAST spellings to keep as alternates once `name` is chosen. */
export function alternateNamesFor(person: SspPerson, name: string): string[] {
  const seen = new Set([plainKey(name)]);
  const out: string[] = [];
  for (const n of [person.iastName, person.name, ...person.alternateNames]) {
    const k = plainKey(n);
    if (!k || seen.has(k)) continue;
    seen.add(k);
    out.push(n);
  }
  return out.slice(0, 50);
}

function guruRow(
  edge: SspPerson['gurus'][number],
  resolved: { id: string; name: string } | undefined
): StoredGuru {
  return {
    ...(resolved ? { id: resolved.id } : {}),
    name: resolved?.name ?? edge.name,
    ...(edge.spiritual ? { relationship: 'spiritual' } : {}),
    source: PEOPLE_SOURCE,
  };
}

export function planSspPersonCreate(
  person: SspPerson,
  opts: { name?: string; resolveGuru?: GuruResolver } = {}
): SspPersonCreatePlan {
  const name = (opts.name ?? '').trim() || person.name;
  const f = person.facts;
  const input: Record<string, unknown> = {
    name,
    gurus: person.gurus.map(g => guruRow(g, opts.resolveGuru?.(g.guruKey))),
    isHistorical: true,
  };
  const alternates = alternateNamesFor(person, name);
  if (alternates.length > 0) input.alternateNames = alternates;
  if (f.birthYear !== undefined) input.birthYear = f.birthYear;
  if (f.deathYear !== undefined) input.deathYear = f.deathYear;
  if (f.birthPlace) input.birthPlace = f.birthPlace;
  if (f.deathPlace) input.deathPlace = f.deathPlace;
  if (f.mudra) input.mudra = f.mudra;
  if (f.works.length > 0) {
    input.works = f.works.map(title => ({ title, source: PEOPLE_SOURCE }));
  }
  // Only the citations whose field is written.
  const citations = person.citations.filter(c => {
    if (c.field === 'alternateNames') return alternates.length > 0;
    return !isEmptyValue(input[c.field]);
  });
  input.citations = citations;
  return { input, citations };
}

// ── attach ────────────────────────────────────────────────────────────────────────────────

const SCALARS = ['birthYear', 'deathYear', 'birthPlace', 'deathPlace', 'mudra'] as const;

export function planSspPersonAttach(
  person: SspPerson,
  stored: SspStoredArtist,
  opts: { resolveGuru?: GuruResolver; name?: string } = {}
): SspPersonAttachPlan {
  const changes: Record<string, PersonFieldChange> = {};
  const update: Record<string, unknown> = {};
  const held: SspHeldValue[] = [];
  const wanted: SspPersonCitation[] = [];
  const cite = (field: string, note?: string) => {
    for (const c of person.citations) {
      if (c.field === field && (note === undefined || c.note === note)) wanted.push(c);
    }
  };

  for (const field of SCALARS) {
    const value = person.facts[field];
    if (value === undefined) continue;
    const have = stored[field];
    if (isEmptyValue(have)) {
      changes[field] = { before: null, after: value };
      update[field] = value;
      cite(field);
    } else if (sameValue(have, value)) {
      cite(field);
    } else {
      held.push({
        field,
        value,
        reason: `stored value differs (${String(have)}); an import never overwrites`,
      });
    }
  }

  if (stored.isHistorical !== true) {
    changes.isHistorical = { before: stored.isHistorical ?? null, after: true };
    update.isHistorical = true;
  }

  // alternateNames: the IAST spelling and every variant, minus what the record already has.
  const existingAlt = stored.alternateNames ?? [];
  const known = new Set([plainKey(stored.name), ...existingAlt.map(plainKey)]);
  const newAlt: string[] = [];
  for (const n of [person.iastName, person.name, ...person.alternateNames]) {
    const k = plainKey(n);
    if (!k || known.has(k)) continue;
    known.add(k);
    newAlt.push(n);
  }
  const altRoom = Math.max(0, 50 - existingAlt.length);
  if (newAlt.length > altRoom) {
    held.push({
      field: 'alternateNames',
      value: newAlt.slice(altRoom),
      reason: 'the list holds 50 names',
    });
  }
  if (newAlt.length > 0 && altRoom > 0) {
    const added = newAlt.slice(0, altRoom);
    const after = [...existingAlt, ...added];
    changes.alternateNames = {
      before: existingAlt.length > 0 ? existingAlt : null,
      after,
      added,
    };
    update.alternateNames = after;
    cite('alternateNames');
  }

  // gurus: merge by id, then by name. A stored row is kept exactly as it is.
  const storedGurus = stored.gurus ?? [];
  const gurusAfter = storedGurus.map(g => ({ ...g }));
  const addedGurus: StoredGuru[] = [];
  const idFilled: { name: string; id: string }[] = [];
  for (const edge of person.gurus) {
    const resolved = opts.resolveGuru?.(edge.guruKey);
    const targetKey = sspNameKey(resolved?.name ?? edge.name);
    const row = gurusAfter.find(
      g =>
        (resolved ? g.id === resolved.id || (!g.id && sspNameKey(g.name) === targetKey) : false) ||
        (!resolved && sspNameKey(g.name) === targetKey)
    );
    if (row) {
      if (!row.id && resolved) {
        row.id = resolved.id;
        idFilled.push({ name: row.name, id: resolved.id });
      }
    } else {
      const created = guruRow(edge, resolved);
      gurusAfter.push(created);
      addedGurus.push(created);
    }
    cite('gurus', edge.name);
  }
  if (addedGurus.length > 0 || idFilled.length > 0) {
    changes.gurus = {
      before: storedGurus.length > 0 ? storedGurus : null,
      after: gurusAfter,
      added: addedGurus,
      ...(idFilled.length > 0 ? { idFilled } : {}),
    };
    update.gurus = gurusAfter;
  }

  // works
  const storedWorks = stored.works ?? [];
  const worksAfter = [...storedWorks];
  const addedWorks: StoredWork[] = [];
  for (const title of person.facts.works) {
    const k = workKey(title);
    const has = worksAfter.some(w => workKey(w.title) === k);
    if (!has) {
      const row = { title, source: PEOPLE_SOURCE };
      worksAfter.push(row);
      addedWorks.push(row);
    }
    cite('works', title);
  }
  if (addedWorks.length > 0) {
    changes.works = {
      before: storedWorks.length > 0 ? storedWorks : null,
      after: worksAfter,
      added: addedWorks,
    };
    update.works = worksAfter;
  }

  const { merged, added } = mergeCitations(stored.citations, wanted as StoredCitation[]);
  if (added.length > 0) {
    if (merged.length > 100) {
      held.push({
        field: 'citations',
        value: added.length,
        reason: 'the citation list holds 100',
      });
    } else {
      update.citations = merged;
    }
  }

  return {
    changes,
    citationsAdded: update.citations ? added : [],
    update,
    held,
  };
}

// ── manifest and undo ─────────────────────────────────────────────────────────────────────

export interface SspPeopleManifestCreated {
  kind: 'created';
  sspKey: string;
  artistId: string;
  name: string;
  undoneAt?: string;
  undoNote?: string;
}

export interface SspPeopleManifestPatched {
  kind: 'patched';
  sspKey: string;
  artistId: string;
  name: string;
  changes: Record<string, PersonFieldChange>;
  citationsAdded: StoredCitation[];
  undoneAt?: string;
  undoSkipped?: { field: string; reason: string }[];
}

export type SspPeopleManifestEntry = SspPeopleManifestCreated | SspPeopleManifestPatched;

export interface SspPersonUndoPlan {
  set: Record<string, unknown>;
  /** Fields that were empty before: remove them (never `.set(undefined)`). */
  remove: string[];
  restored: string[];
  skipped: { field: string; reason: string }[];
  citationsRemoved: number;
}

function rowKey(row: unknown): string {
  if (typeof row === 'string') return `s:${plainKey(row)}`;
  const r = row as { title?: string; name?: string; id?: string };
  if (r.title !== undefined) return `w:${workKey(r.title)}`;
  return `g:${r.id ?? ''}:${plainKey(r.name ?? '')}`;
}

export function planSspPersonUndo(
  entry: Pick<SspPeopleManifestPatched, 'changes' | 'citationsAdded'>,
  current: Record<string, unknown> & { citations?: StoredCitation[] | null }
): SspPersonUndoPlan {
  const set: Record<string, unknown> = {};
  const remove: string[] = [];
  const restored: string[] = [];
  const skipped: { field: string; reason: string }[] = [];

  for (const [field, change] of Object.entries(entry.changes)) {
    const now = current[field];
    if (change.added) {
      // A list: take out the rows this import added, and nothing else.
      const list = Array.isArray(now) ? [...(now as unknown[])] : [];
      const drop = new Set(change.added.map(rowKey));
      let edited = false;
      let remaining = list.filter(row => !drop.has(rowKey(row)));
      if (list.length - remaining.length < change.added.length) edited = true;
      for (const fill of change.idFilled ?? []) {
        remaining = remaining.map(row => {
          const g = row as StoredGuru;
          if (g.id === fill.id && plainKey(g.name) === plainKey(fill.name)) {
            const { id: _id, ...rest } = g;
            return rest;
          }
          return row;
        });
      }
      if (edited)
        skipped.push({ field, reason: 'a row added by the import was edited or removed' });
      if (remaining.length === list.length && !(change.idFilled ?? []).length) continue;
      if (remaining.length === 0 && isEmptyValue(change.before)) remove.push(field);
      else set[field] = remaining;
      restored.push(field);
      continue;
    }
    if (sameValue(now, change.before)) continue; // already back as it was
    if (!sameValue(now, change.after)) {
      skipped.push({ field, reason: 'changed since the import' });
      continue;
    }
    if (isEmptyValue(change.before)) remove.push(field);
    else set[field] = change.before;
    restored.push(field);
  }

  const drop = new Set(entry.citationsAdded.map(citationKey));
  const have = current.citations ?? [];
  const kept = have.filter(c => !drop.has(citationKey(c)));
  if (kept.length !== have.length) {
    if (kept.length > 0) set.citations = kept;
    else remove.push('citations');
  }
  return { set, remove, restored, skipped, citationsRemoved: have.length - kept.length };
}

export interface SspCreatedLinks {
  compositions: number;
  /** Events whose cast names this artist. */
  events: number;
  /** Other artists whose `gurus` carry this id. */
  gurusReferencing: number;
  /** Memberships and affiliations. */
  other?: number;
}

/** A created record goes only when nothing has come to depend on it. */
export function planSspCreatedUndo(links: SspCreatedLinks): { delete: boolean; reasons: string[] } {
  const reasons: string[] = [];
  if (links.compositions > 0) reasons.push(`${links.compositions} compositions name it`);
  if (links.events > 0) reasons.push(`${links.events} events list it`);
  if (links.gurusReferencing > 0) reasons.push(`${links.gurusReferencing} artists name it as guru`);
  if ((links.other ?? 0) > 0) reasons.push(`${links.other} memberships or affiliations`);
  return { delete: reasons.length === 0, reasons };
}
