import {
  SHORT_CODE,
  SHORT_CODE_LENGTH,
  SHORT_CODE_MAX_LENGTH,
  isShortLinkTarget,
  shortLinkCode,
} from './code';
import { ShortLinkEntity } from './entity';

export * from './code';
export type { ShortLink } from './entity';

const MAX_ROUNDS = 4;

/**
 * Codes for a set of targets, creating the rows that are missing. Returns a map from target
 * to code; a target that fails `isShortLinkTarget` is left out, and the caller keeps the long
 * link for it.
 *
 * One batch read covers the usual case, where every row already exists. A code already held
 * by another target is a collision: that target moves to a longer code. At seven base36 digits
 * this needs millions of links to happen at all, so the loop is a guard, not a hot path.
 */
export async function ensureShortLinks(targets: string[]): Promise<Map<string, string>> {
  const result = new Map<string, string>();
  let pending = [...new Set(targets)]
    .filter(isShortLinkTarget)
    .map(target => ({ target, length: SHORT_CODE_LENGTH }));

  // A bounded number of rounds: a create that fails because of an outage, not a race, would
  // otherwise retry for ever. What is left after the last round keeps its long link.
  for (let round = 0; round < MAX_ROUNDS && pending.length > 0; round++) {
    const codes = pending.map(p => shortLinkCode(p.target, p.length));
    const { data } = await ShortLinkEntity.get(codes.map(code => ({ code }))).go();
    const stored = new Map(data.map(row => [row.code, row.target]));
    const next: typeof pending = [];

    await Promise.all(
      pending.map(async (p, i) => {
        const code = codes[i] as string;
        const held = stored.get(code);
        if (held === p.target) {
          result.set(p.target, code);
        } else if (held === undefined) {
          try {
            await ShortLinkEntity.create({ code, target: p.target }).go();
            result.set(p.target, code);
          } catch {
            // Most likely created by a concurrent request since the read, for this target or
            // another: the next round reads it back and decides.
            next.push(p);
          }
        } else if (p.length < SHORT_CODE_MAX_LENGTH) {
          next.push({ ...p, length: p.length + 1 });
        }
      })
    );
    pending = next;
  }
  return result;
}

/** The target a code stands for, or null. */
export async function resolveShortLink(code: string): Promise<string | null> {
  if (!SHORT_CODE.test(code)) return null;
  const { data } = await ShortLinkEntity.get({ code }).go();
  return data?.target ?? null;
}
