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
    expect(row).toContain('1600');
  });

  it('gives each amenity its own yes/blank column', () => {
    const csv = domainToCsv('venue', [{ id: 'v1', name: 'Music Academy', amenities: ['ac'] }]);
    const [header, row] = csv.trimEnd().split('\r\n');
    const columns = header.split(',');
    const cells = row.split(',');

    expect(columns).toContain('amenities_ac');
    expect(columns).toContain('amenities_floor-seating');
    expect(cells[columns.indexOf('amenities_ac')]).toBe('yes');
    expect(cells[columns.indexOf('amenities_parking')]).toBe('');
  });

  it('throws on an unknown domain', () => {
    expect(() => domainToCsv('nope', [])).toThrow('Unknown CSV domain');
  });
});

describe('parseDomainCsv — amenity flag columns', () => {
  const parseAmenities = (header: string, row: string) =>
    parseDomainCsv('venue', `id,name,${header}\r\nv1,Music Academy,${row}`);

  it('collects the ticked columns into the amenities list', () => {
    const { rows, errors } = parseAmenities('amenities_ac,amenities_parking', 'yes,YES');
    expect(errors).toEqual([]);
    expect(rows[0].amenities).toEqual(['ac', 'parking']);
  });

  it('accepts the spreadsheet dialects for a ticked box', () => {
    const { rows } = parseAmenities('amenities_ac,amenities_parking,amenities_library', 'x,TRUE,1');
    expect(rows[0].amenities).toEqual(['ac', 'parking', 'library']);
  });

  it('leaves amenities untouched when every column is blank', () => {
    const { rows, errors } = parseAmenities('amenities_ac,amenities_parking', ',');
    expect(errors).toEqual([]);
    expect(rows[0]).not.toHaveProperty('amenities');
  });

  it('clears the list when a column explicitly says no', () => {
    const { rows, errors } = parseAmenities('amenities_ac,amenities_parking', 'no,');
    expect(errors).toEqual([]);
    expect(rows[0].amenities).toEqual([]);
  });

  it('keeps ticked columns regardless of where a no lands', () => {
    const { rows } = parseAmenities('amenities_ac,amenities_parking', 'no,yes');
    expect(rows[0].amenities).toEqual(['parking']);
  });

  it('reports a cell it cannot read as yes or no', () => {
    const { errors } = parseAmenities('amenities_ac', 'maybe');
    expect(errors).toEqual(['Line 2: amenities_ac: expected yes or no, got "maybe"']);
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
    expect(rows[0]).toEqual(venue);
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
