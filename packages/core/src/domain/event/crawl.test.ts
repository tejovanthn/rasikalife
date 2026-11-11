import { describe, expect, it } from 'vitest';
import apps4uRows from './__fixtures__/apps4u-rows.json';
import mdndRows from './__fixtures__/mdnd-events.json';
import {
  type Apps4uRow,
  type CrawlStoredData,
  type MdndEvent,
  matchArtist,
  matchPlace,
  mdndEventId,
  mdndEventUrl,
  mergeCrawled,
  parseApps4uDate,
  parseApps4uRows,
  parseClock,
  parseMdndDate,
  parseMdndEvents,
  parsePerformers,
  placeKey,
  planCrawl,
  renderReviewSheet,
  splitVenue,
  summarizeCrawl,
} from './crawl';

const apps4u = parseApps4uRows(apps4uRows as Apps4uRow[]);
const mdnd = parseMdndEvents(mdndRows as MdndEvent[]);

describe('dates and times', () => {
  it('reads clocks', () => {
    expect(parseClock('6:15 pm')).toBe('18:15');
    expect(parseClock('12:30 AM')).toBe('00:30');
    expect(parseClock('12 PM')).toBe('12:00');
    expect(parseClock('soon')).toBeNull();
    expect(parseClock(null)).toBeNull();
  });

  it('reads apps4u and mdnd dates, including the unpadded one', () => {
    expect(parseApps4uDate('2027-1-1 Fri')).toBe('2027-01-01');
    expect(parseApps4uDate('2026-12-25 Fri')).toBe('2026-12-25');
    expect(parseMdndDate('25-12-2026')).toBe('2026-12-25');
    expect(parseMdndDate('31-02-2026')).toBeNull();
  });
});

describe('names', () => {
  it('splits a venue at the first comma and reduces to a key', () => {
    expect(splitVenue('Ragasudha Hall, Chennai ').name).toBe('Ragasudha Hall');
    expect(placeKey('Ragasudha  Hall')).toBe('ragasudha hall');
    expect(placeKey('The Music Academy, Chennai')).toBe('music academy');
    expect(placeKey('Vani Mahal, 103, Gopathy Narayana Rd, T. Nagar, Chennai')).toBe('vani mahal');
  });

  it('parses performers, instruments and duets', () => {
    expect(parsePerformers(['Deepika & Nandhika - Violin Duet'], 'main')).toEqual([
      { name: 'Deepika', role: 'Violin Duet', kind: 'main' },
      { name: 'Nandhika', role: 'Violin Duet', kind: 'main' },
    ]);
    const acc = parsePerformers(
      ['Kishore Ramesh - Mridangam, Venkatramanan - Kanjira'],
      'accompanist'
    );
    expect(acc.map(p => p.name)).toEqual(['Kishore Ramesh', 'Venkatramanan']);
    expect(
      parsePerformers(
        [null, 'Kalaimamani Bharathi Thirumagan and Team; commentary by V. Sriram'],
        'main'
      ).map(p => p.name)
    ).toEqual(['Kalaimamani Bharathi Thirumagan']);
    expect(parsePerformers(['Mysore M.Nagaraj (Violin)'], 'main')[0]).toMatchObject({
      name: 'Mysore M.Nagaraj',
      role: 'Violin',
    });
  });
});

describe('mdnd', () => {
  it('reads a listing row', () => {
    const e = mdnd.find(x => x.sourceId === 'mdnd-10773');
    expect(e).toBeDefined();
    expect(e?.startDateTime).toBe('2026-11-11T16:30:00+05:30');
    expect(e?.venueName).toBe('Arkay Convention Center');
    expect(e?.city).toBe('Chennai');
    expect(e?.organiser).toBe('Madhuradhwani');
    expect(e?.entryType).toBe('free');
    expect(e?.posterUrl).toBe(
      'https://api.mdnd.in/public/images/event_images/event_photo_1793769642759.jpeg'
    );
    expect(e?.performers.filter(p => p.kind === 'accompanist').map(p => p.name)).toEqual([
      'Kishore Ramesh',
      'Venkatramanan',
    ]);
  });

  it('falls back to the title when no artist is billed', () => {
    const e = mdnd.find(x => x.sourceId === 'mdnd-10745');
    expect(e?.performers.some(p => p.kind === 'main' && p.name === 'Delhi Sunder Rajan')).toBe(
      true
    );
    expect(e?.organiser).toBe('Ramapriya Arts Foundation');
  });

  it('round-trips the event id through the link', () => {
    expect(mdndEventId(mdndEventUrl(10773, 'A B'))).toBe('10773');
    expect(mdndEventId('https://example.com/')).toBeNull();
  });

  it('strips HTML from descriptions', () => {
    const e = mdnd.find(x => x.sourceId === 'mdnd-10799');
    expect(e?.description).toContain('Villupattu');
    expect(e?.description).not.toContain('<');
  });
});

describe('apps4u', () => {
  it('reads rows and keeps non-mdnd links off the ticket field', () => {
    expect(apps4u.length).toBe(apps4uRows.length);
    const academy = apps4u.find(e => e.sourceUrl.includes('musicacademymadras'));
    expect(academy?.ticketUrl).toContain('musicacademymadras');
    expect(academy?.posterUrl).toBeUndefined();
    const mdndLinked = apps4u.find(e => e.sourceId.startsWith('mdnd-'));
    expect(mdndLinked?.ticketUrl).toBeUndefined();
  });
});

describe('merge', () => {
  it('prefers mdnd and notes apps4u listed it', () => {
    const twin: Apps4uRow = {
      Date: '2026-11-11 Wed',
      Time: '4:30 pm',
      Location: 'Arkay Convention Center',
      Type: 'Violin Duet',
      'Who?': 'Deepika & Nandhika',
      Link: mdndEventUrl(10773, 'Carnatic Violin Duet Concert by Deepika & Nandhika'),
    };
    const merged = mergeCrawled(parseApps4uRows([twin, ...(apps4uRows as Apps4uRow[])]), mdnd);
    const e = merged.find(x => x.sourceId === 'mdnd-10773');
    expect(e?.source).toBe('mdnd');
    expect(e?.alsoListedBy).toEqual(['apps4u']);
    expect(merged.filter(x => x.sourceId === 'mdnd-10773')).toHaveLength(1);
    expect(merged.length).toBe(mdnd.length + apps4uRows.length);
  });
});

describe('matching', () => {
  const venues = [
    { id: 'v1', name: 'Ragasudha Hall' },
    { id: 'v2', name: 'Narada Gana Sabha' },
    { id: 'v3', name: 'Narada Gana Sabha Mini Hall' },
  ];
  it('matches venues by key and holds a near one', () => {
    expect(matchPlace('Ragasudha  Hall, Chennai', venues)).toMatchObject({
      tier: 'exact',
      id: 'v1',
    });
    expect(matchPlace('Hall Rock', venues).tier).toBe('none');
    expect(matchPlace('Narada Gana Sabha - Main Hall', venues).tier).toBe('close');
  });

  it('matches artists with the repo scorer', () => {
    const artists = [
      { id: 'a1', name: 'Delhi Sunder Rajan' },
      { id: 'a2', name: 'Sunil Gargyan' },
    ];
    expect(matchArtist('Delhi Sunder Rajan', artists)).toMatchObject({ tier: 'exact', id: 'a1' });
    expect(matchArtist('Someone Else', artists).tier).toBe('none');
  });
});

describe('plan', () => {
  const stored: CrawlStoredData = {
    artists: [{ id: 'a1', name: 'Delhi Sunder Rajan' }],
    venues: [{ id: 'v1', name: 'Ragasudha Hall' }],
    organisers: [{ id: 'o1', name: 'Madhuradhwani' }],
    events: [
      {
        id: 'e1',
        title: 'Carnatic Vocal Concert by Delhi Sunder Rajan',
        startDateTime: '2026-11-13T18:00:00+05:30',
        venueId: 'v1',
        status: 'approved',
      },
    ],
  };
  const plan = planCrawl(mdnd, stored, '2026-11-11');
  const byKey = (k: string) => plan.find(p => p.key === k);

  it('flags a duplicate and holds it', () => {
    const p = byKey('mdnd:mdnd-10745');
    expect(p?.duplicates[0]).toMatchObject({ id: 'e1', reason: 'same-venue-within-window' });
    expect(p?.decision).toBe('skip');
  });

  it('creates an in-scope, new, future event', () => {
    const p = byKey('mdnd:mdnd-10773');
    expect(p?.decision).toBe('create');
    expect(p?.organiser?.tier).toBe('exact');
    expect(p?.venue.willCreate).toBe(true);
  });

  it('holds film and talk events as out of scope', () => {
    expect(byKey('mdnd:mdnd-10670')?.decision).toBe('skip');
  });

  it('holds events in the past', () => {
    const late = planCrawl(mdnd, stored, '2027-01-01');
    expect(late.every(p => p.decision === 'skip')).toBe(true);
  });

  it('summarises and renders a sheet', () => {
    const summary = summarizeCrawl(plan);
    expect(summary.total).toBe(mdnd.length);
    expect(summary.chennai).toBe(mdnd.length);
    expect(summary.duplicates).toBe(1);
    const sheet = renderReviewSheet(plan, summary, {
      generatedAt: '2026-11-11T00:00:00Z',
      sources: ['mdnd'],
    });
    expect(sheet).toContain('Would create');
    expect(sheet).toContain('mdnd:mdnd-10745');
  });
});

describe('non-people in a billing', () => {
  it('drops "Students"', () => {
    expect(parsePerformers(['Students - P. S. School'], 'main')).toEqual([]);
  });
});
