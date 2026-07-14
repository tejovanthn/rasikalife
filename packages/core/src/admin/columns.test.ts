import { describe, expect, it } from 'vitest';
import { ADMIN_CSV_DOMAINS, domainToCsv, parseDomainCsv } from './columns';

describe('domainToCsv', () => {
  it('renders the header row plus one row per entity', () => {
    const csv = domainToCsv('venue', [
      { id: 'v1', name: 'Music Academy', amenities: ['ac', 'parking'], capacity: 1600 },
    ]);
    const [header, row] = csv.trimEnd().split('\r\n');
    expect(header.startsWith('id,name,address_street')).toBe(true);
    expect(row).toContain('v1');
    expect(row).toContain('ac|parking');
    expect(row).toContain('1600');
  });

  it('throws on an unknown domain', () => {
    expect(() => domainToCsv('nope', [])).toThrow('Unknown CSV domain');
  });
});

describe('parseDomainCsv — venue round-trip', () => {
  it('flattens address, lists, and social links back into a row', () => {
    const venue = {
      id: 'v1',
      name: 'Music Academy',
      address: { street: 'TTK Road', city: 'Chennai', state: 'Tamil Nadu' },
      capacity: 1600,
      amenities: ['ac', 'parking', 'green-room'],
      socialLinks: [{ platform: 'instagram', url: 'https://instagram.com/x' }],
    };
    const { rows, errors } = parseDomainCsv('venue', domainToCsv('venue', [venue]));
    expect(errors).toEqual([]);
    expect(rows[0]).toEqual({
      id: 'v1',
      name: 'Music Academy',
      address: { street: 'TTK Road', city: 'Chennai', state: 'Tamil Nadu' },
      capacity: 1600,
      amenities: ['ac', 'parking', 'green-room'],
      socialLinks: [{ platform: 'instagram', url: 'https://instagram.com/x' }],
    });
  });
});

describe('parseDomainCsv — linked entities render as names', () => {
  it('turns composition links into resolvable name fields', () => {
    const composition = {
      id: 'c1',
      title: 'Vatapi Ganapatim',
      composer: { id: 'a1', name: 'Muthuswami Dikshitar' },
      language: 'Sanskrit',
      ragas: [{ id: 'r1', name: 'Hamsadhwani' }],
      talas: [{ id: 't1', name: 'Adi' }],
      lyricsV1: [{ type: 'pallavi', order: 1, text: 'Vatapi' }],
    };
    const csv = domainToCsv('composition', [composition]);
    expect(csv).toContain('Muthuswami Dikshitar');
    expect(csv).toContain('Hamsadhwani');

    const { rows, errors } = parseDomainCsv('composition', csv);
    expect(errors).toEqual([]);
    expect(rows[0]).toEqual({
      id: 'c1',
      title: 'Vatapi Ganapatim',
      composerName: 'Muthuswami Dikshitar',
      language: 'Sanskrit',
      ragaNames: ['Hamsadhwani'],
      talaNames: ['Adi'],
      lyricsV1: [{ type: 'pallavi', order: 1, text: 'Vatapi' }],
    });
  });

  it('round-trips event JSON blocks and artist names', () => {
    const event = {
      id: 'e1',
      title: 'Margazhi Kutcheri',
      startDateTime: '2026-01-01T18:00:00+05:30',
      timezone: 'Asia/Kolkata',
      venueName: 'Music Academy',
      artists: [{ id: 'a1', name: 'Sanjay Subrahmanyan' }],
      tags: ['carnatic'],
      entryType: 'ticketed',
      ticketing: { url: 'https://tickets.example.com' },
    };
    const { rows, errors } = parseDomainCsv('event', domainToCsv('event', [event]));
    expect(errors).toEqual([]);
    expect(rows[0]).toMatchObject({
      id: 'e1',
      title: 'Margazhi Kutcheri',
      venueName: 'Music Academy',
      artistNames: ['Sanjay Subrahmanyan'],
      tags: ['carnatic'],
      ticketing: { url: 'https://tickets.example.com' },
    });
  });
});

describe('parseDomainCsv — validation and errors', () => {
  it('flags a non-numeric number cell but keeps the row', () => {
    const { rows, errors } = parseDomainCsv(
      'raga',
      'id,name,melaNumber\r\nr1,Kalyani,twenty-nine\r\n'
    );
    expect(rows).toEqual([{ id: 'r1', name: 'Kalyani' }]);
    expect(errors[0]).toContain('melaNumber');
  });

  it('reports invalid JSON in a nested column', () => {
    const { errors } = parseDomainCsv('tala', 'id,name,angaStructure\r\nt1,Adi,{not json}\r\n');
    expect(errors[0]).toContain('angaStructure');
  });

  it('skips rows that carry data but no id, name, or title', () => {
    const { rows, errors } = parseDomainCsv(
      'event',
      'id,title,description\r\n,,orphan desc\r\ne1,Kept,\r\n'
    );
    expect(rows).toEqual([{ id: 'e1', title: 'Kept' }]);
    expect(errors[0]).toContain('Line 2');
  });

  it('errors on an unknown domain', () => {
    expect(() => parseDomainCsv('nope', 'a\r\n1\r\n')).toThrow('Unknown CSV domain');
  });
});

describe('every domain exposes an id column', () => {
  it.each(Object.keys(ADMIN_CSV_DOMAINS))('%s has an id header', domain => {
    expect(ADMIN_CSV_DOMAINS[domain].columns.some(column => column.header === 'id')).toBe(true);
  });
});
