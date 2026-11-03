import { describe, expect, it } from 'vitest';
import type { SspResult } from './ssp';
import { citationKey, mergeCitations, planSspApply, planSspUndo, sameValue } from './ssp-apply';

const cite = (field: string, locator = 'Vol. 1, p. 84', extra = {}) => ({
  field,
  sourceSlug: 'ssp-2008-english',
  locator,
  ...extra,
});

describe('mergeCitations', () => {
  it('adds new citations and never drops a stored one', () => {
    const stored = [cite('timeOfDay'), { ...cite('rasa'), sourceSlug: 'other' }];
    const { merged, added } = mergeCitations(stored, [cite('timeOfDay'), cite('scaleType')]);
    expect(merged).toHaveLength(3);
    expect(added).toEqual([cite('scaleType')]);
    expect(merged.slice(0, 2)).toEqual(stored);
  });

  it('treats tradition and note as part of the key', () => {
    const a = cite('timeOfDay', 'p', { tradition: 'Dikshitar school' });
    const b = cite('timeOfDay', 'p');
    expect(citationKey(a)).not.toBe(citationKey(b));
    expect(mergeCitations([b], [a]).added).toEqual([a]);
  });

  it('dedupes within the incoming list', () => {
    expect(mergeCitations([], [cite('rasa'), cite('rasa')]).added).toHaveLength(1);
  });
});

describe('planSspApply', () => {
  const result: SspResult = {
    patch: { timeOfDay: 'evening', jivaSwaras: ['G2', 'N2'] },
    citations: [cite('timeOfDay'), cite('jivaSwaras')],
    held: [{ field: 'prayogas', value: 'x', reason: 'variant uncertain' }],
    notes: ['n'],
  };

  it('records before and after and merges citations', () => {
    const stored = { arohanam: 'S R2', citations: [cite('arohanam', 'x')] };
    const plan = planSspApply(result, stored);
    expect(plan.error).toBeUndefined();
    expect(plan.changes.timeOfDay).toEqual({ before: null, after: 'evening' });
    expect(plan.citationsAdded).toHaveLength(2);
    expect((plan.update.citations as unknown[]).length).toBe(3);
    expect(plan.held).toHaveLength(1);
  });

  it('writes nothing when the stored value already equals the patch and citations exist', () => {
    const stored = {
      timeOfDay: 'evening',
      jivaSwaras: ['G2', 'N2'],
      citations: result.citations,
    };
    const plan = planSspApply(result, stored as never);
    expect(plan.changes).toEqual({});
    expect(plan.update).toEqual({});
  });

  it('reports a schema error instead of a payload', () => {
    const bad: SspResult = { ...result, patch: { jivaSwaras: ['Q9'] } };
    expect(planSspApply(bad, {}).error).toBeTruthy();
  });
});

describe('planSspUndo', () => {
  const changes = {
    timeOfDay: { before: null, after: 'evening' },
    scaleType: { before: 'sampurna', after: 'audava' },
  };
  const added = [cite('timeOfDay'), cite('scaleType')];

  it('restores untouched fields and removes empty-before fields', () => {
    const current = {
      timeOfDay: 'evening',
      scaleType: 'audava',
      arohanam: 'S R2 G2',
      citations: [...added, cite('arohanam', 'keep')],
    };
    const plan = planSspUndo({ changes, citationsAdded: added }, current);
    expect(plan.remove).toEqual(['timeOfDay']);
    expect(plan.set.scaleType).toBe('sampurna');
    expect(plan.set.citations).toEqual([cite('arohanam', 'keep')]);
    expect(plan.skipped).toEqual([]);
  });

  it('skips a field changed since the import, but still removes the citations', () => {
    const current = { timeOfDay: 'night', scaleType: 'audava', citations: added };
    const plan = planSspUndo({ changes, citationsAdded: added }, current);
    expect(plan.skipped).toEqual([{ field: 'timeOfDay', reason: 'changed since the import' }]);
    expect(plan.remove).toContain('citations');
    expect(plan.citationsRemoved).toBe(2);
  });

  it('removes the citations attribute when none are left', () => {
    const plan = planSspUndo({ changes: {}, citationsAdded: added }, { citations: added });
    expect(plan.remove).toEqual(['citations']);
  });

  it('is a no-op when everything was already undone', () => {
    const plan = planSspUndo(
      { changes, citationsAdded: added },
      { scaleType: 'sampurna', citations: [] }
    );
    expect(plan.skipped.map(s => s.field)).toEqual([]);
    expect(plan.remove).toEqual([]);
    expect(plan.set).toEqual({});
  });
});

describe('sameValue', () => {
  it('ignores key order and treats empty values alike', () => {
    expect(sameValue({ a: 1, b: 2 }, { b: 2, a: 1 })).toBe(true);
    expect(sameValue(undefined, [])).toBe(true);
    expect(sameValue(['a'], ['b'])).toBe(false);
  });
});
