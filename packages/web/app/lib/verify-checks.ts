/**
 * What the verify step asks a submitter to look at before they submit. The extractor returns
 * one confidence number per poster, not one per field, so a per-field "low confidence" mark
 * would be invented. These are the checks the draft itself can back: a field left empty, a
 * name that matched nothing we hold (submitting it creates a new record), a date already past
 * (the extractor supplies a year when the poster prints none), and a poster the model itself
 * found hard to read.
 */

export const LOW_CONFIDENCE = 0.6;

export interface CheckableDraft {
  title: string;
  startDateTime: string;
  venue?: { name: string; id?: string };
  organiser?: { name: string; id?: string };
  artists: Array<{ name: string; id?: string }>;
  extractionConfidence?: number;
}

export function fieldsToCheck(draft: CheckableDraft, now: Date = new Date()): string[] {
  const checks: string[] = [];
  if (draft.extractionConfidence !== undefined && draft.extractionConfidence < LOW_CONFIDENCE) {
    checks.push('The poster was hard to read. Check every field against it.');
  }
  if (!draft.title.trim()) checks.push('No title was found.');

  const at = Date.parse(draft.startDateTime);
  if (!draft.startDateTime || Number.isNaN(at)) {
    checks.push('No date or time was found.');
  } else if (at < now.getTime()) {
    checks.push('The date is in the past. Check the year.');
  }

  if (!draft.venue?.name.trim()) {
    checks.push('No venue was found.');
  } else if (!draft.venue.id) {
    checks.push(`"${draft.venue.name}" is a new venue to us. Check the spelling.`);
  }
  if (draft.organiser?.name.trim() && !draft.organiser.id) {
    checks.push(`"${draft.organiser.name}" is a new organiser to us. Check the spelling.`);
  }

  const named = draft.artists.filter(a => a.name.trim());
  if (named.length === 0) {
    checks.push('No performers were found.');
  } else {
    const fresh = named.filter(a => !a.id).map(a => a.name.trim());
    if (fresh.length > 0) {
      checks.push(`New performers to us: ${fresh.join(', ')}. Check each name.`);
    }
  }
  return checks;
}
