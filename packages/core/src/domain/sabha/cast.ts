/**
 * Pure rules for an owner's edit of the billed artists. The form shows the cast as names in one
 * text field; the stored cast also has ids, roles and titles that the form cannot carry. So an
 * edit is merged onto what is stored and never rebuilt from the names alone.
 */

export interface CastEntry {
  id?: string | null;
  name: string;
  role?: string | null;
  title?: string | null;
}

function nameKey(name: string): string {
  return name.replace(/\s+/g, ' ').trim().toLowerCase();
}

/**
 * The cast after an owner edit, or `null` when the typed names equal the stored ones and
 * nothing should be written. A typed name that matches a stored entry keeps that entry whole
 * (id, role, title). A new name is built by `makeEntry`. A stored entry whose name is no longer
 * typed is dropped, and nothing else is.
 */
export async function mergeOwnerCast(
  stored: CastEntry[],
  typed: Array<{ name: string }>,
  makeEntry: (name: string) => Promise<CastEntry>
): Promise<CastEntry[] | null> {
  const storedByName = new Map<string, CastEntry>();
  for (const entry of stored) {
    const key = nameKey(entry.name);
    if (!storedByName.has(key)) storedByName.set(key, entry);
  }
  const typedKeys: string[] = [];
  for (const { name } of typed) {
    const key = nameKey(name);
    if (key && !typedKeys.includes(key)) typedKeys.push(key);
  }
  const unchanged =
    typedKeys.length === stored.length &&
    stored.every((entry, i) => nameKey(entry.name) === typedKeys[i]);
  if (unchanged) return null;

  const result: CastEntry[] = [];
  for (const key of typedKeys) {
    const kept = storedByName.get(key);
    if (kept) {
      result.push(kept);
      continue;
    }
    const original = typed.find(t => nameKey(t.name) === key);
    result.push(await makeEntry(original?.name ?? key));
  }
  return result;
}
