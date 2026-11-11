import { describe, expect, it } from 'vitest';
import apps4uRows from './__fixtures__/apps4u-rows.json';
import mdndRows from './__fixtures__/mdnd-events.json';
import {
  type Apps4uRow,
  type CrawlStoredData,
  type MdndEvent,
  type MdndListRow,
  applyPosterExtraction,
  coverageReport,
  matchArtist,
  matchPlace,
  mdndEventId,
  mdndEventUrl,
  mdndHint,
  mdndMonthWindows,
  mergeCrawled,
  parseApps4uDate,
  parseApps4uRows,
  parseClock,
  parseMdndDate,
  parseMdndDisplayDate,
  parseMdndEvents,
  parseMdndListRows,
  parsePerformers,
  placeKey,
  planCrawl,
  renderReviewSheet,
  splitVenue,
  summarizeCrawl,
  unionMdnd,
  venuesAgree,
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

describe('cross-source merge by day, time and venue', () => {
  const rows: Apps4uRow[] = [
    {
      Date: '2026-11-11 Wed',
      Time: '4:30 pm',
      Location: 'Arkay Convention Center, Chennai',
      Type: 'Vocal - Violin',
      'Who?': 'V. Deepika and V. Nandika',
      Link: 'https://events.apps4u.net/',
    },
    {
      Date: '2026-11-13 Fri',
      Time: '6:00 pm',
      Location: 'Ragasudha Hall, Chennai',
      Type: 'Vocal',
      'Who?': 'Delhi P. Sunder Rajan',
      Link: '',
    },
    {
      Date: '2026-11-13 Fri',
      Time: '6:00 pm',
      Location: 'Some Other Hall',
      Type: 'Vocal',
      'Who?': 'Unrelated Singer',
      Link: '',
    },
  ];
  const merged = mergeCrawled(parseApps4uRows(rows), mdnd);
  const find = (id: string) => merged.find(e => e.sourceId === id);

  it('keeps mdnd for Deepika and Nandika, with fuller names and the apps4u key', () => {
    const e = find('mdnd-10773');
    expect(e?.source).toBe('mdnd');
    expect(e?.title).toBe('Carnatic Violin Duet Concert by Deepika & Nandhika');
    expect(e?.mergedWith?.[0]).toMatchObject({ source: 'apps4u', by: 'slot' });
    expect(e?.mergedWith?.[0].key).toMatch(/^apps4u:/);
    expect(e?.alsoListedBy).toEqual(['apps4u']);
    const mains = e?.performers.filter(p => p.kind === 'main').map(p => p.name);
    expect(mains).toEqual(['V. Deepika', 'V. Nandika']);
    expect(e?.performers.find(p => p.name === 'V. Deepika')?.variants).toContain('Deepika');
    expect(e?.performers.some(p => p.kind === 'accompanist')).toBe(true);
  });

  it('keeps mdnd for Delhi Sunder Rajan', () => {
    const e = find('mdnd-10745');
    expect(e?.source).toBe('mdnd');
    expect(e?.title).toBe('Carnatic Vocal Concert by Delhi Sunder Rajan');
    expect(e?.mergedWith).toHaveLength(1);
    expect(e?.performers[0].name).toBe('Delhi P. Sunder Rajan');
  });

  it('leaves a different concert alone, even at the same hour', () => {
    expect(merged.filter(e => e.source === 'apps4u')).toHaveLength(1);
    expect(merged).toHaveLength(mdnd.length + 1);
  });

  it('does not merge when the start is more than 30 minutes apart', () => {
    const late = parseApps4uRows([{ ...rows[1], Time: '7:00 pm' }]);
    expect(mergeCrawled(late, mdnd)).toHaveLength(mdnd.length + 1);
  });

  it('plans one new artist per person and shows the merge in the sheet', () => {
    const stored: CrawlStoredData = { artists: [], venues: [], organisers: [], events: [] };
    const plan = planCrawl(merged, stored, '2026-11-11');
    const names = plan.flatMap(p => p.performers.map(x => x.name));
    expect(names).not.toContain('Deepika');
    expect(names).not.toContain('Delhi Sunder Rajan');
    const summary = summarizeCrawl(plan);
    expect(summary.merged.bySlot).toBe(2);
    expect(summary.eventsBeforeMerge).toBe(summary.total + 2);
    const sheet = renderReviewSheet(plan, summary, {
      generatedAt: '2026-11-11T00:00:00Z',
      sources: ['mdnd', 'apps4u'],
    });
    expect(sheet).toContain('merged with apps4u:');
    expect(sheet).toContain('V. Deepika <- ');
  });

  it('matches a stored artist spelled with an initial', () => {
    const m = matchArtist('Delhi Sunder Rajan', [{ id: 'a1', name: 'Delhi P. Sunder Rajan' }]);
    expect(m).toMatchObject({ tier: 'exact', id: 'a1' });
  });

  it('holds a venue that differs only by a suffix, and keeps mini and main halls apart', () => {
    const venues = [{ id: 'v1', name: 'Bharatiya Vidya Bhavan (Main Auditorium)' }];
    expect(matchPlace('Bharathiya Vidya Bhavan Main Hall', venues).tier).toBe('close');
    expect(
      venuesAgree('Music Academy Mini Hall (Kasthuri Srinivasan Hall)', 'The Music Academy')
    ).toBe(false);
    expect(venuesAgree('Narada Gana Sabha - Main Hall', 'Narada Gana Sabha')).toBe(true);
  });
});

describe('mdnd month paging', () => {
  it('splits a season into calendar months with the ends kept', () => {
    expect(mdndMonthWindows('2026-11-11', '2027-01-31')).toEqual([
      { label: '2026-11', from: '2026-11-11', to: '2026-11-30' },
      { label: '2026-12', from: '2026-12-01', to: '2026-12-31' },
      { label: '2027-01', from: '2027-01-01', to: '2027-01-31' },
    ]);
    expect(mdndMonthWindows('2026-12-05', '2026-12-20')).toHaveLength(1);
  });

  it('reads the display date', () => {
    expect(parseMdndDisplayDate('Wed, 11th Nov 2026')).toBe('2026-11-11');
    expect(parseMdndDisplayDate('Sat, 2nd Jan 2027')).toBe('2027-01-02');
    expect(parseMdndDisplayDate('soon')).toBeNull();
  });

  const thin: MdndListRow[] = [
    {
      event_id: '10900',
      event_title: 'Carnatic Vocal Concert by Sandeep Narayan | Music Academy',
      event_date: 'Sun, 6th Dec 2026',
      event_time: '6:30 PM',
      ticketing_option: 'ticketed',
      venue_name: 'The Music Academy, Chennai',
      event_image: 'event_photo_1.jpeg',
    },
    { event_id: 1, event_title: 'No date', event_date: '' },
  ];

  it('reads thin rows, with the poster and the artist named in the title', () => {
    const [e, ...rest] = parseMdndListRows(thin, 8);
    expect(rest).toHaveLength(0);
    expect(e).toMatchObject({
      sourceId: 'mdnd-10900',
      date: '2026-12-06',
      startDateTime: '2026-12-06T18:30:00+05:30',
      category: 'Carnatic',
    });
    expect(e.posterUrl).toContain('event_photo_1.jpeg');
    expect(e.performers.map(p => p.name)).toEqual(['Sandeep Narayan']);
  });

  it('keeps a full row over a thin one for the same id', () => {
    const [full] = mdnd;
    const thinOfFull = { ...full, performers: [], category: 'Carnatic' };
    const out = unionMdnd([full], [thinOfFull]);
    expect(out).toHaveLength(1);
    expect(out[0].performers.length).toBeGreaterThan(0);
  });
});

describe('apps4u as a gap-filler', () => {
  const rows: Apps4uRow[] = [
    {
      Date: '2026-11-11 Wed',
      Time: '4:30 pm',
      Location: 'Arkay Convention Center',
      Type: 'Vocal - Violin',
      'Who?': 'V. Deepika and V. Nandika',
      Link: '',
    },
    {
      Date: '2026-11-13 Fri',
      Time: '6:00 pm',
      Location: 'Ragasudha Hall',
      Type: 'Vocal',
      'Who?': 'Delhi P. Sunder Rajan',
      Link: '',
    },
    {
      Date: '2026-12-06 Sun',
      Time: '6:30 pm',
      Location: 'Music Academy',
      Type: 'Vocal',
      'Who?': 'Sanjay Subrahmanyan',
      Link: '',
    },
  ];

  it('drops the pairs mdnd has and keeps the one it lacks', () => {
    const report = coverageReport(parseApps4uRows(rows), mdnd);
    expect(report.apps4u).toMatchObject({ total: 3, covered: 2, gaps: 1 });
    expect(report.gapList).toHaveLength(1);
    expect(report.gapList[0]).toContain('Sanjay Subrahmanyan');
    expect(report.mdnd.total).toBe(mdnd.length);
    expect(report.mdnd.byMonth['2026-11'].events).toBeGreaterThan(0);
  });

  it('puts the gap into the plan as a plain listing with no poster', () => {
    const plan = planCrawl(
      mergeCrawled(parseApps4uRows(rows), mdnd),
      {
        artists: [],
        venues: [],
        organisers: [],
        events: [],
      },
      '2026-11-11'
    );
    const gap = plan.find(p => p.event.source === 'apps4u');
    expect(gap?.event.posterUrl).toBeUndefined();
    expect(plan.filter(p => p.event.source === 'apps4u')).toHaveLength(1);
  });
});

describe('poster extraction applied to a listing', () => {
  const [base] = parseMdndListRows(
    [
      {
        event_id: 7,
        event_title: 'Evening Concert',
        event_date: 'Sun, 6th Dec 2026',
        event_time: '6:30 PM',
        venue_name: 'The Music Academy, Chennai',
        event_image: 'p.jpeg',
      },
    ],
    8
  );
  const extraction = (start: string, venue = 'Music Academy') => ({
    confidence: 0.9,
    events: [
      {
        startDateTime: start,
        venue: { name: venue },
        organiser: { name: 'Madhuradhwani' },
        artists: [
          { name: 'Sandeep Narayan', role: 'vocal' },
          { name: 'R Raghul', role: 'violin' },
          { name: 'Some Dignitary', role: 'chief-guest' },
        ],
      },
    ],
  });

  it('takes people and organiser from the poster, keeps the listing time', () => {
    const e = applyPosterExtraction(base, extraction('2026-12-06T18:30:00+05:30'));
    expect(e.performers).toEqual([
      { name: 'Sandeep Narayan', role: 'vocal', kind: 'main' },
      { name: 'R Raghul', role: 'violin', kind: 'accompanist' },
    ]);
    expect(e.organiser).toBe('Madhuradhwani');
    expect(e.startDateTime).toBe(base.startDateTime);
    expect(e.posterExtraction?.mismatches).toEqual([]);
  });

  it('holds the row when the poster disagrees', () => {
    const e = applyPosterExtraction(base, extraction('2026-12-07T18:30:00+05:30'));
    expect(e.posterExtraction?.mismatches[0]).toContain('poster');
    const plan = planCrawl(
      [e],
      { artists: [], venues: [], organisers: [], events: [] },
      '2026-11-11'
    );
    expect(plan[0].decision).toBe('skip');
    expect(plan[0].skipReasons.join(' ')).toContain('poster disagrees');
  });

  it('does not apply a poster with several events', () => {
    const two = { confidence: 1, events: [...extraction('x').events, ...extraction('y').events] };
    const e = applyPosterExtraction(base, two);
    expect(e.performers).toEqual(base.performers);
    expect(e.posterExtraction?.mismatches[0]).toContain('2 events');
  });

  it('builds a hint that names the listing as a hint', () => {
    expect(mdndHint(base)).toContain('hint only');
    expect(mdndHint(base)).toContain('date: 2026-12-06');
  });
});
