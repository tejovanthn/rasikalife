import { describe, expect, it } from 'vitest';
import { ADMIN_COPY, ADMIN_EXTRA_COPY } from './copy';
import { isModeratorRole } from './gate';
import {
  assignItems,
  assignPath,
  fillLabels,
  filterVenues,
  formatWhen,
  parseCodeInput,
  parseListFilters,
  readAssignRows,
  shouldPollBatch,
  testScanUrl,
} from './qr-admin';

describe('parseCodeInput', () => {
  it('accepts a code in any case, with spaces or dashes', () => {
    expect(parseCodeInput('abcd efgh')).toBe('ABCDEFGH');
    expect(parseCodeInput(' ABCD-EFGH ')).toBe('ABCDEFGH');
  });

  it('folds the Crockford look-alikes: I and L are 1, O is 0', () => {
    expect(parseCodeInput('ILOABCDE')).toBe('110ABCDE');
  });

  it('rejects the wrong length and letters outside the alphabet', () => {
    expect(parseCodeInput('ABC')).toBeNull();
    expect(parseCodeInput('ABCDEFGHJ')).toBeNull();
    expect(parseCodeInput('ABCDEFGU')).toBeNull();
    expect(parseCodeInput('ABCDEF!H')).toBeNull();
    expect(parseCodeInput('')).toBeNull();
    expect(parseCodeInput(null)).toBeNull();
  });
});

describe('filterVenues', () => {
  const venues = [
    { id: '1', name: 'Narada Gana Sabha', city: 'Chennai' },
    { id: '2', name: 'Chowdiah Memorial Hall', city: 'Bengaluru' },
    { id: '3', name: 'Bangalore Gayana Samaja', city: 'Bengaluru' },
    { id: '4', name: 'Café Sabha', city: null },
  ];

  it('returns everything, capped, for an empty query', () => {
    expect(filterVenues(venues, '', 2)).toHaveLength(2);
  });

  it('matches the name first, then the city, ignoring case and diacritics', () => {
    expect(filterVenues(venues, 'chow').map(v => v.id)).toEqual(['2']);
    expect(filterVenues(venues, 'CAFE').map(v => v.id)).toEqual(['4']);
    expect(filterVenues(venues, 'bengaluru').map(v => v.id)).toEqual(['3', '2']);
  });

  it('puts a prefix match before a contains match', () => {
    expect(filterVenues(venues, 'sabha').map(v => v.id)).toEqual(['4', '1']);
    expect(filterVenues(venues, 'ga').map(v => v.id)[0]).toBe('3');
  });
});

describe('parseListFilters', () => {
  it('keeps known filters and drops an unknown status', () => {
    const params = new URLSearchParams('status=active&batchId=b1&venueId=v1&cursor=abc');
    expect(parseListFilters(params)).toEqual({
      status: 'active',
      batchId: 'b1',
      venueId: 'v1',
      cursor: 'abc',
    });
    expect(parseListFilters(new URLSearchParams('status=hacked')).status).toBeUndefined();
  });
});

describe('small helpers', () => {
  it('builds the test scan and assign links', () => {
    expect(testScanUrl('https://rasika.life/', 'ABCDEFGH')).toBe('https://rasika.life/q/ABCDEFGH');
    expect(assignPath('ABCDEFGH')).toBe('/qr/ABCDEFGH/assign');
  });

  it('polls only while the PDF is pending', () => {
    expect(shouldPollBatch('pending')).toBe(true);
    expect(shouldPollBatch('ready')).toBe(false);
    expect(shouldPollBatch('failed')).toBe(false);
  });

  it('formats a time in IST', () => {
    expect(formatWhen('2026-11-12T12:30:00.000Z')).toBe('12 Nov, 6:00 pm');
    expect(formatWhen(undefined)).toBe('');
    expect(formatWhen('nonsense')).toBe('');
  });

  it('fills empty labels of ticked rows, numbered by ticked position', () => {
    const rows = [
      { code: 'A', label: '', ticked: true },
      { code: 'B', label: '', ticked: false },
      { code: 'C', label: 'Ticket desk', ticked: true },
      { code: 'D', label: '  ', ticked: true },
    ];
    expect(fillLabels(rows, ' Entrance ').map(r => r.label)).toEqual([
      'Entrance 1',
      '',
      'Ticket desk',
      'Entrance 3',
    ]);
    expect(fillLabels(rows, '  ')).toBe(rows);
  });

  it('reads rows in page order with their own labels', () => {
    const form = new FormData();
    form.append('codes', 'C');
    form.append('codes', 'A');
    form.append('label-A', 'Door');
    form.append('label-B', 'Unticked');
    expect(readAssignRows(form, ['A', 'B', 'C'])).toEqual([
      { code: 'A', label: 'Door', ticked: true },
      { code: 'B', label: 'Unticked', ticked: false },
      { code: 'C', label: '', ticked: true },
    ]);
  });

  it('splits ticked rows into items and codes with no label, capped', () => {
    const rows = [
      { code: 'A', label: ' Door ', ticked: true },
      { code: 'B', label: '', ticked: true },
      { code: 'C', label: 'Desk', ticked: false },
      { code: 'D', label: 'Hall', ticked: true },
    ];
    expect(assignItems(rows, 50)).toEqual({
      items: [
        { code: 'A', label: 'Door' },
        { code: 'D', label: 'Hall' },
      ],
      missing: ['B'],
      ticked: 3,
    });
    expect(assignItems(rows, 1)).toEqual({
      items: [{ code: 'A', label: 'Door' }],
      missing: [],
      ticked: 1,
    });
    expect(assignItems([], 50).ticked).toBe(0);
  });
});

describe('role gate', () => {
  it('admits moderators and admins only', () => {
    expect(isModeratorRole('moderator')).toBe(true);
    expect(isModeratorRole('admin')).toBe(true);
    expect(isModeratorRole('editor')).toBe(false);
    expect(isModeratorRole('user')).toBe(false);
    expect(isModeratorRole(undefined)).toBe(false);
  });
});

describe('copy', () => {
  it('fills placeholders and shows no braces or em dashes', () => {
    const strings = [
      ADMIN_COPY.assign.title('ABCDEFGH'),
      ADMIN_COPY.assign.success('ABCDEFGH', 'Narada Gana Sabha'),
      ADMIN_COPY.assign.alreadyActive('Narada Gana Sabha'),
      ADMIN_COPY.bulkAssign.submit(12),
      ADMIN_COPY.retire.title('ABCDEFGH'),
      ADMIN_COPY.retire.body('Narada Gana Sabha'),
      ...(Object.values(ADMIN_EXTRA_COPY).filter(v => typeof v === 'string') as string[]),
    ];
    for (const text of strings) {
      expect(text).not.toMatch(/[{}]/);
      expect(text).not.toContain('—');
    }
    expect(ADMIN_COPY.bulkAssign.submit(12)).toBe('Activate 12 codes');
    expect(ADMIN_COPY.assign.success('X', 'Y')).toBe('Code X is live at Y.');
  });
});
