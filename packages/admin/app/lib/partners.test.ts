import { describe, expect, it } from 'vitest';
import { ADMIN_COPY } from './copy';
import { formatEventWhen, isTargetType, partnerPath, searchPartnerTargets } from './partners';
import type { PartnerTarget } from './partners';

const t = (targetType: PartnerTarget['targetType'], id: string, name: string, city?: string) =>
  ({ targetType, id, name, city: city ?? null }) satisfies PartnerTarget;

const targets = [
  t('organiser', 'o1', 'Bangalore Gayana Samaja', 'Bengaluru'),
  t('venue', 'v1', 'Gayana Samaja Hall', 'Bengaluru'),
  t('organiser', 'o2', 'Narada Gana Sabha', 'Chennai'),
  t('venue', 'v2', 'Chowdiah Memorial Hall', 'Bengaluru'),
];

describe('searchPartnerTargets', () => {
  it('lists nothing for an empty query', () => {
    expect(searchPartnerTargets(targets, '  ')).toEqual([]);
  });

  it('puts names that start with the query first, then names that contain it, then cities', () => {
    expect(searchPartnerTargets(targets, 'gayana').map(r => r.id)).toEqual(['v1', 'o1']);
    expect(searchPartnerTargets(targets, 'chennai').map(r => r.id)).toEqual(['o2']);
  });

  it('keeps an organiser and a venue with the same name apart by type', () => {
    const both = searchPartnerTargets(
      [t('organiser', 'x', 'Hamsadhwani'), t('venue', 'y', 'Hamsadhwani')],
      'hamsa'
    );
    expect(both.map(r => r.targetType).sort()).toEqual(['organiser', 'venue']);
  });

  it('ignores case and accents and caps the list', () => {
    expect(searchPartnerTargets(targets, 'NÃRADA').map(r => r.id)).toEqual(['o2']);
    expect(searchPartnerTargets(targets, 'NARADA').map(r => r.id)).toEqual(['o2']);
    expect(searchPartnerTargets(targets, 'a', 2)).toHaveLength(2);
  });
});

describe('partner urls', () => {
  it('builds an encoded path and checks the type', () => {
    expect(partnerPath('venue', 'a b')).toBe('/sabhas/venue/a%20b');
    expect(isTargetType('organiser')).toBe(true);
    expect(isTargetType('artist')).toBe(false);
    expect(isTargetType(undefined)).toBe(false);
  });
});

describe('formatEventWhen', () => {
  it('reads the time in the event zone, not the runtime zone', () => {
    expect(formatEventWhen('2026-11-16T12:30:00.000Z', 'Asia/Kolkata')).toBe('Mon 16 Nov, 6:00 pm');
  });
});

describe('invite copy', () => {
  it('is verbatim from the Copy tab', () => {
    expect(ADMIN_COPY.invite).toMatchObject({
      email: 'Email',
      role: 'Role',
      owner: 'Owner',
      viewer: 'Viewer',
      submit: 'Send invite',
    });
  });
});
