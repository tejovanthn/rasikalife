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
  const parsed = Number.parseInt(trimmed, 10);
  return Number.isNaN(parsed) ? undefined : parsed;
}
