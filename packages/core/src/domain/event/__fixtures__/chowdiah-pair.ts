/**
 * The 2026-11 pair on prod: one festival entered twice from two posters. Same hall, same start,
 * 17:30 IST on 2026-11-11. The first entry names no artist; the second has the full cast.
 */
export const CHOWDIAH_VENUE = '3GjIUL0IhoJYKawBkWgbvbMrvUG';

export const chowdiahFirst = {
  id: '3LYmGTEVDhL0rHGB558A9KirtkJ',
  title: 'Flute Concert',
  startDateTime: '2026-11-11T17:30:00+05:30',
  venueId: CHOWDIAH_VENUE,
  status: 'approved',
  artists: [],
  festivalId: '3LYmGUGanvVgR32TtbtCzq2TIIx',
  createdAt: '2026-10-20T10:00:00.000Z',
};

export const chowdiahSecond = {
  id: '3LbYyiiWvIRvDQNAhXNq6DMN66q',
  title: 'Flute Concert by Sri. Amith A. Nadig',
  startDateTime: '2026-11-11T17:30:00+05:30',
  venueId: CHOWDIAH_VENUE,
  status: 'submitted',
  artists: [{ id: 'a1', name: 'Amith A. Nadig', role: 'flute' }],
  posterUrl: 'https://example.com/p.jpg',
  festivalId: '3LbYykrsOJA2SZuy5qqwUWSpcOP',
  createdAt: '2026-10-25T10:00:00.000Z',
};

export const chowdiahFestivals = [
  {
    id: '3LYmGUGanvVgR32TtbtCzq2TIIx',
    name: 'Chowdiah Utsava - Sri K. K. Murthy Memorial Music Festival',
    startDate: '2026-11-09',
    endDate: '2026-11-13',
    status: 'approved',
  },
  {
    id: '3LbYykrsOJA2SZuy5qqwUWSpcOP',
    name: 'Chowdiah Utsava',
    startDate: '2026-11-09',
    endDate: '2026-11-13',
    status: 'submitted',
  },
];
