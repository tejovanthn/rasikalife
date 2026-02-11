export interface FieldChange {
  field: string;
  oldValue: unknown;
  newValue: unknown;
}

export function computeEditDiff(
  before: Record<string, unknown>,
  after: Record<string, unknown>
): FieldChange[] {
  const diff: FieldChange[] = [];

  for (const key of Object.keys(after)) {
    const beforeValue = before[key];
    const afterValue = after[key];

    if (JSON.stringify(beforeValue) === JSON.stringify(afterValue)) {
      continue;
    }

    diff.push({
      field: key,
      oldValue: beforeValue,
      newValue: afterValue,
    });
  }

  return diff;
}

export function formatValue(value: unknown): string {
  if (value === null || value === undefined) {
    return '(empty)';
  }

  if (Array.isArray(value)) {
    if (value.length === 0) {
      return '(empty)';
    }
    if (value.every(item => typeof item === 'object' && item && 'name' in item)) {
      return value.map(item => (item as { name: string }).name).join(', ');
    }
    if (value.every(item => typeof item === 'string')) {
      return `${value.length} item${value.length !== 1 ? 's' : ''}`;
    }
    return JSON.stringify(value, null, 2);
  }

  if (typeof value === 'object') {
    if ('name' in value && typeof value.name === 'string') {
      return value.name;
    }
    const json = JSON.stringify(value, null, 2);
    if (json.length > 100) {
      return `${json.substring(0, 100)}...`;
    }
    return json;
  }

  return String(value);
}
