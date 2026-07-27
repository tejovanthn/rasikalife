// `FormData.get` returns `null` when a key is absent and `''` when a key is
// submitted empty. The common `((formData.get(key) as string) || '').trim() || undefined`
// idiom collapses both cases to `undefined`, so a moderator can never clear a field
// once set — patch handlers treat `undefined` as "leave alone". This helper keeps
// the two cases apart: `undefined` means "not submitted, preserve"; `''` means
// "submitted empty, clear"; anything else is the trimmed value.
export function readClearableField(formData: FormData, key: string): string | undefined {
  const raw = formData.get(key);
  if (raw === null) return undefined;
  return (raw as string).trim();
}

// The sibling trap for numbers: `Number.parseInt(raw, 10) || undefined` throws away a
// legitimate 0 along with the parse failures, and patch handlers read that `undefined`
// as "leave alone". For gallery `order` that means a photo can never be moved into the
// first slot — the write is silently dropped and the photo snaps back on reload. Only an
// absent, empty, or unparseable value is `undefined` here; 0 survives.
export function readOptionalInt(formData: FormData, key: string): number | undefined {
  const raw = formData.get(key);
  if (raw === null) return undefined;
  const trimmed = (raw as string).trim();
  if (!trimmed) return undefined;
  // Number() rather than parseInt: parseInt reads a prefix, so '12.7' would become 12 and
  // '1e3' would become 1 — a silent misreading rather than a rejection.
  const parsed = Number(trimmed);
  return Number.isInteger(parsed) ? parsed : undefined;
}
