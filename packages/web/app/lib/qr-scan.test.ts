import type { ScanEventView } from '@rasika/core/domain/venue-qr/client';
import { describe, expect, it } from 'vitest';
import {
  adminAssignUrl,
  buildFollowRows,
  buildSelection,
  doneHref,
  followsEverything,
  normaliseWhatsapp,
  parseDoneKeys,
  rowKey,
  scanEventTitle,
  summaryLine,
} from './qr-scan';

const event: ScanEventView = {
  id: 'e1',
  title: 'Carnatic Music Concert',
  startDateTime: '2026-11-16T18:00:00+05:30',
  timezone: 'Asia/Kolkata',
  organiserId: 'o1',
  organiserName: 'Narada Gana Sabha',
  venueName: 'Hall',
  artists: [
    { id: 'a-violin', name: 'V', role: 'accompanist' },
    { id: 'a-main', title: 'Vid.', name: 'Main Singer', role: 'main' },
    { id: null, name: 'No Id', role: 'mridangam' },
    { id: 'a-mrid', name: 'M', role: 'mridangam' },
    { id: 'a-main', name: 'Dup', role: 'main' },
  ],
};

describe('buildFollowRows', () => {
  const rows = buildFollowRows({ venue: { id: 'v1', name: 'Hall' }, event });

  it('orders venue, organiser, principal, other, accompanist', () => {
    expect(rows.map(r => r.key)).toEqual([
      'venue:v1',
      'organiser:o1',
      'artist:a-main',
      'artist:a-mrid',
      'artist:a-violin',
    ]);
  });

  it('uses the copy subtitles and falls back to Artist for a billing role', () => {
    expect(rows[0].subtitle).toBe('Venue');
    expect(rows[1].subtitle).toBe('Organiser');
    expect(rows[2].subtitle).toBe('Artist');
    expect(rows[3].subtitle).toBe('mridangam');
    expect(rows[2].name).toBe('Vid. Main Singer');
  });

  it('venue mode lists the organisers given', () => {
    const r = buildFollowRows({
      venue: { id: 'v1', name: 'Hall' },
      organisers: [
        { id: 'o1', name: 'A' },
        { id: 'o2', name: 'B' },
      ],
    });
    expect(r.map(x => x.key)).toEqual(['venue:v1', 'organiser:o1', 'organiser:o2']);
  });
});

describe('buildSelection', () => {
  const base = {
    rows: ['venue:v1', 'organiser:o1', 'artist:a1'],
    follow: [] as string[],
    share: [] as string[],
    was: [] as string[],
    wasShared: [] as string[],
  };

  it('nothing ticked is refused', () => {
    expect(buildSelection(base)).toEqual({ ok: false, error: 'nothing-selected' });
  });

  it('follows only what is ticked, never sharing by default', () => {
    const out = buildSelection({ ...base, follow: ['venue:v1', 'artist:a1'] });
    expect(out).toEqual({
      ok: true,
      targets: [
        { type: 'venue', id: 'v1', follow: true },
        { type: 'artist', id: 'a1', follow: true },
      ],
    });
  });

  it('sends share only for a ticked venue or organiser with its box ticked', () => {
    const out = buildSelection({
      ...base,
      follow: ['venue:v1', 'organiser:o1'],
      share: ['organiser:o1', 'artist:a1'],
    });
    expect(out.ok && out.targets).toEqual([
      { type: 'venue', id: 'v1', follow: true },
      { type: 'organiser', id: 'o1', follow: true, share: true },
    ]);
  });

  it('ignores the share box of a target that is off', () => {
    const out = buildSelection({ ...base, follow: ['venue:v1'], share: ['organiser:o1'] });
    expect(out.ok && out.targets).toEqual([{ type: 'venue', id: 'v1', follow: true }]);
  });

  it('follow all ticks every row but shares nothing', () => {
    const out = buildSelection({ ...base, intent: 'all', share: ['venue:v1'] });
    expect(out.ok && out.targets.every(t => t.follow && t.share === undefined)).toBe(true);
    expect(out.ok && out.targets).toHaveLength(3);
  });

  it('an earlier follow that is now unticked is an unfollow', () => {
    const out = buildSelection({ ...base, follow: ['venue:v1'], was: ['artist:a1', 'venue:v1'] });
    expect(out.ok && out.targets).toEqual([
      { type: 'venue', id: 'v1', follow: true },
      { type: 'artist', id: 'a1', follow: false },
    ]);
  });

  it('does not re-send an unchanged consent, and sends a withdrawal', () => {
    const same = buildSelection({
      ...base,
      follow: ['venue:v1', 'organiser:o1'],
      share: ['venue:v1'],
      was: ['venue:v1', 'organiser:o1'],
      wasShared: ['venue:v1', 'organiser:o1'],
    });
    expect(same.ok && same.targets).toEqual([
      { type: 'venue', id: 'v1', follow: true },
      { type: 'organiser', id: 'o1', follow: true, share: false },
    ]);
  });

  it('drops keys that are not rows on the screen', () => {
    const out = buildSelection({ ...base, follow: ['venue:evil', 'venue:v1'] });
    expect(out.ok && out.targets).toEqual([{ type: 'venue', id: 'v1', follow: true }]);
  });
});

describe('summary and helpers', () => {
  it('summaryLine follows the copy', () => {
    expect(summaryLine([])).toBeNull();
    expect(summaryLine(['A'])).toBe("You're following A.");
    expect(summaryLine(['A', 'B', 'C'])).toBe("You're following 3: A, B and more.");
  });

  it('followsEverything', () => {
    const rows = buildFollowRows({ venue: { id: 'v1', name: 'Hall' }, event });
    expect(followsEverything(rows, new Set(rows.map(r => r.key)))).toBe(true);
    expect(followsEverything(rows, new Set([rowKey('venue', 'v1')]))).toBe(false);
  });

  it('replaces a generic title with the lead artist', () => {
    expect(scanEventTitle(event)).not.toBe('Carnatic Music Concert');
    expect(scanEventTitle({ ...event, title: 'Vasantotsava', artists: [] })).toBe('Vasantotsava');
  });

  it('normaliseWhatsapp', () => {
    expect(normaliseWhatsapp('98450 12345')).toBe('9845012345');
    expect(normaliseWhatsapp('+91 98450-12345')).toBe('9845012345');
    expect(normaliseWhatsapp('1234567890')).toBeNull();
    expect(normaliseWhatsapp('98450')).toBeNull();
  });

  it('adminAssignUrl follows the stage domain', () => {
    expect(adminAssignUrl('https://rasika.life/q/ABCDEFGH', 'ABCDEFGH')).toBe(
      'https://admin.rasika.life/qr/ABCDEFGH/assign'
    );
    expect(adminAssignUrl('https://dev.rasika.life/q/X', 'ABCDEFGH')).toBe(
      'https://admin.dev.rasika.life/qr/ABCDEFGH/assign'
    );
    expect(adminAssignUrl('https://www.rasika.life/q/X', 'ABCDEFGH')).toBe(
      'https://admin.rasika.life/qr/ABCDEFGH/assign'
    );
  });

  it('doneHref round-trips through parseDoneKeys', () => {
    const href = doneHref('ABCDEFGH', 'e1', ['venue:v1', 'artist:a1']);
    const t = new URL(href, 'https://x').searchParams.get('t');
    expect(parseDoneKeys(t)).toEqual(['venue:v1', 'artist:a1']);
    expect(parseDoneKeys('bogus,venue:v1')).toEqual(['venue:v1']);
    expect(doneHref('ABCDEFGH', undefined, [])).toBe('/q/ABCDEFGH/done');
  });
});
