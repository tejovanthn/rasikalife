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

/**
 * Reads a repeated group of form fields — one row per index across several parallel arrays —
 * into a list of objects, dropping any row whose required field is blank.
 *
 * Repeated `name` attributes are how the wizard submits a variable-length list without
 * JSON-encoding it into a hidden input, so `formData.getAll(key)[i]` is row `i` of that
 * column. The rows are correlated purely by index, which is why a row that renders must
 * always emit every one of its inputs, even when empty.
 *
 * A blank optional is omitted from the result rather than set to `undefined`, so the object
 * spreads cleanly into a Zod-validated payload where an absent key and an explicitly
 * undefined one are not the same thing to every consumer.
 */
export function readRepeatedRows(
  formData: FormData,
  spec: {
    required: string;
    strings?: Record<string, string>;
    numbers?: Record<string, string>;
  }
): Array<{ required: string; rest: Record<string, string | number> }> {
  const requiredValues = formData.getAll(spec.required) as string[];
  const columns = {
    strings: Object.entries(spec.strings ?? {}).map(
      ([field, key]) => [field, formData.getAll(key) as string[]] as const
    ),
    numbers: Object.entries(spec.numbers ?? {}).map(
      ([field, key]) => [field, formData.getAll(key) as string[]] as const
    ),
  };

  const rows: Array<{ required: string; rest: Record<string, string | number> }> = [];
  for (const [index, rawRequired] of requiredValues.entries()) {
    const required = (rawRequired || '').trim();
    if (!required) continue;

    const rest: Record<string, string | number> = {};
    for (const [field, values] of columns.strings) {
      const value = (values[index] || '').trim();
      if (value) rest[field] = value;
    }
    for (const [field, values] of columns.numbers) {
      const value = (values[index] || '').trim();
      if (!value) continue;
      // Same reasoning as readOptionalInt: reject rather than silently truncate.
      const parsed = Number(value);
      if (Number.isInteger(parsed)) rest[field] = parsed;
    }
    rows.push({ required, rest });
  }
  return rows;
}
