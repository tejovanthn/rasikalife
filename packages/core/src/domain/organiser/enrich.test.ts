import { describe, expect, it } from 'vitest';

import {
  type EnrichmentEvent,
  missingOrganiserContact,
  organisationTypeFromName,
  organiserContactFromEvents,
  organiserTagsFromEvents,
} from './enrich';

const event = (over: Partial<EnrichmentEvent> = {}): EnrichmentEvent => ({
  artForm: 'carnatic',
  tags: ['concert'],
  entryType: 'free',
  startDateTime: '2025-04-01T18:30:00.000Z',
  ...over,
});

describe('organisationTypeFromName', () => {
  it('reads the type a name states outright', () => {
    expect(organisationTypeFromName('Kailas Sangeet Trust')).toBe('trust');
    expect(organisationTypeFromName('Arulmigu Sri Kapaleeswarar Temple')).toBe('temple');
    expect(organisationTypeFromName('Girinagara Sangeetha Sabha - Bangalore')).toBe('sabha');
    expect(organisationTypeFromName('Suswaralaya College of Music (R)')).toBe('university');
  });

  it('leaves "Foundation" undecided rather than inventing a legal fact', () => {
    // The enum offers `trust` and `ngo`; a foundation is registered as either and the name
    // does not say which.
    expect(organisationTypeFromName('Essae Music Foundation')).toBeUndefined();
    expect(organisationTypeFromName('Makaranda Foundation')).toBeUndefined();
  });

  it('reads a mutt as a temple before its trust wording', () => {
    expect(
      organisationTypeFromName(
        'Jagadguru Sri Ramanujacharya Maha Samsthanam Sri Yadugiri Yathiraja Mutt'
      )
    ).toBe('temple');
  });

  it('does not read a metaphorical temple as a shrine', () => {
    expect(organisationTypeFromName('Samskruthi - The Temple of Art')).toBeUndefined();
  });

  it('does not read "vedike" as a sabha', () => {
    // It means "forum" and says nothing about the body behind it.
    expect(organisationTypeFromName('Rashtriya Nava Nirmana Vedike')).toBeUndefined();
  });

  it('does not promote a school to a university', () => {
    // The enum has no entry for a school, and `university` is a claim about accreditation.
    expect(
      organisationTypeFromName('SAPTHAK, Bangalore & Nataraj Sangeeta Vidyalaya and Kalasangha')
    ).toBeUndefined();
  });
});

describe('organiserContactFromEvents', () => {
  it('lifts website, phone and email off the organiser’s own events', () => {
    const events = [
      event({
        contactInfo: { website: 'www.trikalaarts.com', email: 'trikalafinearts@gmail.com' },
      }),
      event({
        contactInfo: { website: 'www.trikalaarts.com', email: 'trikalafinearts@gmail.com' },
      }),
    ];
    expect(organiserContactFromEvents(events)).toEqual({
      website: 'https://www.trikalaarts.com',
      email: 'trikalafinearts@gmail.com',
    });
  });

  it('makes the website absolute, because the schema requires a URL', () => {
    const bare = organiserContactFromEvents([
      event({ contactInfo: { website: 'vanamalaarts.org' } }),
    ]);
    expect(bare.website).toBe('https://vanamalaarts.org');

    const already = organiserContactFromEvents([
      event({ contactInfo: { website: 'http://nadasurabhi.org' } }),
    ]);
    expect(already.website).toBe('http://nadasurabhi.org');
  });

  it('lowercases a shouted URL', () => {
    const contact = organiserContactFromEvents([
      event({ contactInfo: { website: 'WWW.RAMANAVAMITICKETS.COM' } }),
    ]);
    expect(contact.website).toBe('https://www.ramanavamitickets.com');
  });

  it('keeps the fuller number when events disagree by being a superset', () => {
    const contact = organiserContactFromEvents([
      event({ contactInfo: { phone: '+919845514661' } }),
      event({ contactInfo: { phone: '+919845514661, +919844746077' } }),
      event({ contactInfo: { phone: '+919845514661, +919844746077' } }),
    ]);
    expect(contact.phone).toBe('+919845514661, +919844746077');
  });

  it('drops a phone value too long for the column rather than truncating it', () => {
    // `phone` is capped at 30 characters and several events pack three numbers into it.
    const contact = organiserContactFromEvents([
      event({ contactInfo: { phone: '9448079079 / 9483518012 / 080-26604031' } }),
    ]);
    expect(contact.phone).toBeUndefined();
  });

  it('ignores nulls, blanks and a missing block', () => {
    expect(
      organiserContactFromEvents([
        event({ contactInfo: { website: null, phone: '  ', email: undefined } }),
        event({ contactInfo: undefined }),
      ])
    ).toEqual({});
  });
});

describe('missingOrganiserContact', () => {
  const derived = {
    website: 'https://vanamalaarts.org',
    phone: '+919845514661',
    email: 'info@vanamalaarts.org',
  };

  it('offers only the fields the organiser does not already hold', () => {
    expect(missingOrganiserContact({ phone: '080-26506049' }, derived)).toEqual({
      website: 'https://vanamalaarts.org',
      email: 'info@vanamalaarts.org',
    });
  });

  it('never overwrites what a person stored, even with a fuller value', () => {
    expect(
      missingOrganiserContact({ website: 'http://old.example' }, derived).website
    ).toBeUndefined();
  });

  it('treats a whitespace-only stored value as empty', () => {
    expect(missingOrganiserContact({ email: '   ' }, derived).email).toBe('info@vanamalaarts.org');
  });

  it('is empty when the organiser already holds everything, so the cascade is idempotent', () => {
    expect(
      missingOrganiserContact({ website: 'https://x.org', phone: '123', email: 'a@b.c' }, derived)
    ).toEqual({});
  });

  it('offers nothing when the event carried nothing', () => {
    expect(missingOrganiserContact({}, {})).toEqual({});
  });
});

describe('organiserTagsFromEvents', () => {
  it('describes what the organiser actually programmed', () => {
    const tags = organiserTagsFromEvents({
      name: 'Nadasurabhi Cultural Association',
      events: [
        event({ artForm: 'carnatic', tags: ['concert', 'vocal'], entryType: 'free' }),
        event({ artForm: 'carnatic', tags: ['concert', 'violin'], entryType: 'free' }),
      ],
    });
    expect(tags).toContain('carnatic');
    expect(tags).toContain('free-entry');
    expect(tags).toContain('instrumental');
  });

  it('returns tags in the enum’s order, so a re-run does not rewrite the row', () => {
    const input = {
      name: 'X',
      events: [event({ artForm: 'bharatanatyam', tags: ['dance-recital'], entryType: 'ticketed' })],
    };
    expect(organiserTagsFromEvents(input)).toEqual(organiserTagsFromEvents(input));
    expect(organiserTagsFromEvents(input)).toEqual(['bharatanatyam', 'dance', 'ticketed']);
  });

  it('needs two events for a tag, or a third of a small programme', () => {
    // One hindustani concert out of six is not evidence the body programmes hindustani.
    const tags = organiserTagsFromEvents({
      name: 'X',
      events: [
        ...Array.from({ length: 5 }, () => event({ artForm: 'carnatic' })),
        event({ artForm: 'hindustani' }),
      ],
    });
    expect(tags).toContain('carnatic');
    expect(tags).not.toContain('hindustani');
  });

  it('tags a single-event organiser from that one event', () => {
    const tags = organiserTagsFromEvents({
      name: 'X',
      events: [event({ artForm: 'hindustani', tags: [] })],
    });
    expect(tags).toContain('hindustani');
  });

  it('calls a body year-round only when it works across five months', () => {
    const months = (n: number) =>
      Array.from({ length: n }, (_, i) =>
        event({ startDateTime: `2025-0${i + 1}-01T00:00:00.000Z` })
      );
    expect(organiserTagsFromEvents({ name: 'X', events: months(4) })).not.toContain('year-round');
    expect(organiserTagsFromEvents({ name: 'X', events: months(5) })).toContain('year-round');
  });

  it('reads music-school and charitable off the name, since no event states them', () => {
    expect(organiserTagsFromEvents({ name: 'Omkar Music Academy', events: [event()] })).toContain(
      'music-school'
    );
    expect(
      organiserTagsFromEvents({ name: 'Shambhavi School of Dance', events: [event()] })
    ).toContain('music-school');
    expect(
      organiserTagsFromEvents({
        name: 'Shruti Sindhura Academy of Music Charitable Trust',
        events: [event()],
      })
    ).toContain('charitable');
  });

  it('does not call every "Academy" a music school', () => {
    // The Karnataka Engineers Academy's hall hosts concerts; it teaches nobody to sing.
    expect(
      organiserTagsFromEvents({ name: 'Karnataka Engineers Academy', events: [event()] })
    ).not.toContain('music-school');
    expect(
      organiserTagsFromEvents({ name: 'Nrityoma Academy of Performing Arts', events: [event()] })
    ).toContain('music-school');
  });

  it('returns nothing for an organiser with no events', () => {
    expect(organiserTagsFromEvents({ name: 'Omkar Music Academy', events: [] })).toEqual([]);
  });
});
