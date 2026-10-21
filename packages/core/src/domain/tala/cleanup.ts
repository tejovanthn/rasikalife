/**
 * Cleaning the tala table.
 *
 * Of 75 tala records, 13 carry nearly every composition. The rest came out of the karnatik.com
 * import, where a page's header was split on the wrong full stop: a raga name landed in the tala
 * column (`kAnaDA.`, `Bhairavi.`), or a fragment of "no given tALA" did (`given`, `or`, `m`).
 * Others are one tala spelled twice (`cepmat` beside `cempat`), or two talas offered as
 * alternatives in one name (`Adi/rUpaka`).
 *
 * Four decisions, one per record:
 *
 * - `keep` — a tala, even an uncommon one (`aTanta` is a Kathakali tala, `bilandi` is how Swati
 *   Tirunal's Hindustani pieces are marked).
 * - `merge:<name>` — the same tala under another spelling.
 * - `split:<name>|<name>` — alternatives. Each composition gets every named tala instead.
 * - `unlink` — not a tala. It comes off every composition and the record is soft-deleted.
 *   Nothing is put in its place: a raga name in the tala column says nothing about the tala.
 *
 * `suggestTalaCleanup` pre-fills the report from rules that are certain or close to it; a person
 * writes the decision column.
 */

export type TalaCleanupDecision =
  | { kind: 'keep' }
  | { kind: 'merge'; into: string }
  | { kind: 'split'; into: string[] }
  | { kind: 'unlink' };

/** Reads the `decision` column. Returns `undefined` for anything it does not recognise. */
export function parseTalaCleanupDecision(value: string): TalaCleanupDecision | undefined {
  const text = value.trim();
  if (text === 'keep') return { kind: 'keep' };
  if (text === 'unlink') return { kind: 'unlink' };
  const merge = /^merge:(.+)$/.exec(text);
  if (merge?.[1]?.trim()) return { kind: 'merge', into: merge[1].trim() };
  const split = /^split:(.+)$/.exec(text);
  if (split?.[1]) {
    const into = split[1]
      .split('|')
      .map(s => s.trim())
      .filter(Boolean);
    if (into.length >= 2) return { kind: 'split', into };
  }
  return undefined;
}

export function formatTalaCleanupDecision(decision: TalaCleanupDecision): string {
  switch (decision.kind) {
    case 'merge':
      return `merge:${decision.into}`;
    case 'split':
      return `split:${decision.into.join('|')}`;
    default:
      return decision.kind;
  }
}

/** Case, punctuation and spacing removed, plus the spellings romanisations disagree on. */
export function talaKey(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z]/g, '')
    .replace(/aa/g, 'a')
    .replace(/oo/g, 'u')
    .replace(/ee/g, 'i')
    .replace(/(.)\1+/g, '$1')
    .replace(/(am|m|a)$/, '');
}

/** Words that are never a tala on their own: the remains of "no given rAgA or tALA". */
const FRAGMENTS = new Set(['', 'm', 'or', 'given', 'none', 'no', 'not', 'tala']);

/**
 * A pre-filled decision, or `undefined` to leave the row for a person.
 *
 * `canonical` is the list of tala names to merge into. `ragaKeys` holds `talaKey` of every raga
 * name: a tala record whose name is a raga is certainly not a tala.
 */
export function suggestTalaCleanup(
  name: string,
  canonical: readonly string[],
  ragaKeys: ReadonlySet<string>
): TalaCleanupDecision | undefined {
  const byKey = new Map(canonical.map(c => [talaKey(c), c]));
  const key = talaKey(name);
  const own = byKey.get(key);
  if (own) return own === name ? { kind: 'keep' } : { kind: 'merge', into: own };
  if (FRAGMENTS.has(key)) return { kind: 'unlink' };
  if (ragaKeys.has(key)) return { kind: 'unlink' };

  const parts = name
    .split(/\/|\bor\b/)
    .map(p => byKey.get(talaKey(p)))
    .filter((p): p is string => Boolean(p));
  const distinct = [...new Set(parts)];
  if (distinct.length >= 2) return { kind: 'split', into: distinct };
  if (distinct.length === 1 && distinct[0]) return { kind: 'merge', into: distinct[0] };
  return undefined;
}

/** The talas a composition holds after a decision about one of them. Order is kept. */
export function talaIdsAfter(
  current: readonly string[],
  loserId: string,
  replacementIds: readonly string[]
): string[] {
  const out: string[] = [];
  for (const id of current) {
    const next = id === loserId ? replacementIds : [id];
    for (const n of next) if (!out.includes(n)) out.push(n);
  }
  return out;
}
