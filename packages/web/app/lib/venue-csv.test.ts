import type { Venue } from '@rasika/core/domain/venue/client';
import { describe, expect, it } from 'vitest';
import { VENUE_CSV_HEADERS, parseVenuesCsv, venuesToCsv } from './venue-csv';

const fullVenue: Venue = {
  id: 'venue-1',
  name: 'Music Academy',
  address: {
    street: 'TTK Road',
    city: 'Chennai',
    state: 'Tamil Nadu',
    postalCode: '600014',
    country: 'India',
  },
  city: 'Chennai',
  mapLink: 'https://maps.example.com/ma',
  description: 'Historic sabha, home of the December season.',
  venueType: 'auditorium',
  capacity: 1600,
  website: 'https://musicacademymadras.in',
  phone: '+91 44 2811 2231',
  email: 'info@musicacademymadras.in',
  amenities: ['ac', 'parking', 'green-room'],
  nearestTransit: 'Thousand Lights Metro',
  foundedYear: 1928,
  socialLinks: [
    { platform: 'instagram', url: 'https://instagram.com/musicacademy' },
    { platform: 'youtube', url: 'https://youtube.com/@musicacademy' },
  ],
  createdAt: '2025-01-01T00:00:00.000Z',
  updatedAt: '2025-01-01T00:00:00.000Z',
};

describe('venuesToCsv', () => {
  it('emits the header row followed by one row per venue', () => {
    const csv = venuesToCsv([fullVenue]);
    const [headerLine, dataLine] = csv.trimEnd().split('\r\n');
    expect(headerLine).toBe(VENUE_CSV_HEADERS.join(','));
    expect(dataLine).toContain('venue-1');
    expect(dataLine).toContain('ac|parking|green-room');
    expect(dataLine).toContain('instagram:https://instagram.com/musicacademy');
  });

  it('leaves optional fields blank without inventing values', () => {
    const sparse: Venue = {
      id: 'venue-2',
      name: 'Terrace Concert',
      createdAt: '2025-01-01T00:00:00.000Z',
      updatedAt: '2025-01-01T00:00:00.000Z',
    };
    const dataLine = venuesToCsv([sparse]).trimEnd().split('\r\n')[1];
    expect(dataLine).toBe('venue-2,Terrace Concert,,,,,,,,,,,,,,,,,');
  });
});

describe('parseVenuesCsv', () => {
  it('round-trips every field back into a structured row', () => {
    const { rows, errors } = parseVenuesCsv(venuesToCsv([fullVenue]));
    expect(errors).toEqual([]);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toEqual({
      id: 'venue-1',
      name: 'Music Academy',
      address: {
        street: 'TTK Road',
        city: 'Chennai',
        state: 'Tamil Nadu',
        postalCode: '600014',
        country: 'India',
      },
      mapLink: 'https://maps.example.com/ma',
      description: 'Historic sabha, home of the December season.',
      venueType: 'auditorium',
      capacity: 1600,
      website: 'https://musicacademymadras.in',
      phone: '+91 44 2811 2231',
      email: 'info@musicacademymadras.in',
      nearestTransit: 'Thousand Lights Metro',
      foundedYear: 1928,
      amenities: ['ac', 'parking', 'green-room'],
      socialLinks: [
        { platform: 'instagram', url: 'https://instagram.com/musicacademy' },
        { platform: 'youtube', url: 'https://youtube.com/@musicacademy' },
      ],
    });
  });

  it('treats a blank id as a new venue (create) and keeps it out of the row', () => {
    const csv = 'id,name\r\n,Brand New Hall\r\n';
    const { rows } = parseVenuesCsv(csv);
    expect(rows).toEqual([{ name: 'Brand New Hall' }]);
    expect(rows[0]).not.toHaveProperty('id');
  });

  it('tolerates reordered and missing columns', () => {
    const csv = 'name,capacity,id\r\nOpen Air,300,venue-9\r\n';
    const { rows, errors } = parseVenuesCsv(csv);
    expect(errors).toEqual([]);
    expect(rows).toEqual([{ id: 'venue-9', name: 'Open Air', capacity: 300 }]);
  });

  it('reports rows with neither id nor name and skips them', () => {
    const csv = 'id,name,city\r\n,,Chennai\r\nvenue-3,Kept,Madurai\r\n';
    const { rows, errors } = parseVenuesCsv(csv);
    expect(rows).toEqual([{ id: 'venue-3', name: 'Kept' }]);
    expect(errors[0]).toContain('Line 2');
  });

  it('flags non-numeric capacity but still keeps the row', () => {
    const csv = 'id,name,capacity\r\nvenue-4,Sabha,lots\r\n';
    const { rows, errors } = parseVenuesCsv(csv);
    expect(rows).toEqual([{ id: 'venue-4', name: 'Sabha' }]);
    expect(errors[0]).toContain('capacity');
  });

  it('errors when the required name column is absent', () => {
    const { rows, errors } = parseVenuesCsv('id,capacity\r\nvenue-5,100\r\n');
    expect(rows).toEqual([]);
    expect(errors[0]).toContain('name');
  });
});
