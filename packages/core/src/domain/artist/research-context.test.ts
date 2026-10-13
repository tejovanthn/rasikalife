import { describe, expect, it } from 'vitest';

import { buildArtistContext, buildComposerContext, withComposers } from './research-context';

const credit = (
  over: Partial<{
    eventId: string;
    artistId: string;
    artistName: string;
    role: string;
    eventStartDateTime: string;
  }>
) => ({
  eventId: 'e1',
  artistId: 'a1',
  artistName: 'A',
  eventStartDateTime: '2026-01-01T00:00:00.000Z',
  ...over,
});

const event = (
  over: Partial<{
    id: string;
    deletedAt: string;
    venueName: string;
    organiserName: string;
    artForm: string;
  }>
) => ({
  id: 'e1',
  ...over,
});

describe('buildArtistContext', () => {
  it('gathers what the database knows about one artist', () => {
    const context = buildArtistContext(
      [
        credit({
          eventId: 'e1',
          artistId: 'a1',
          role: 'vocal',
          eventStartDateTime: '2024-03-02T00:00:00.000Z',
        }),
        credit({
          eventId: 'e2',
          artistId: 'a1',
          role: 'vocal',
          eventStartDateTime: '2026-05-09T00:00:00.000Z',
        }),
      ],
      [
        event({
          id: 'e1',
          venueName: 'Gayana Samaja',
          organiserName: 'Trikala',
          artForm: 'carnatic',
        }),
        event({
          id: 'e2',
          venueName: 'Chowdiah Memorial Hall',
          organiserName: 'Trikala',
          artForm: 'carnatic',
        }),
      ]
    );

    expect(context.get('a1')).toMatchObject({
      appearances: 2,
      roles: ['vocal'],
      venues: ['Gayana Samaja', 'Chowdiah Memorial Hall'],
      organisers: ['Trikala'],
      artForms: ['carnatic'],
      firstSeen: '2024-03-02',
      lastSeen: '2026-05-09',
    });
  });

  it('names who they share a stage with, and never themselves', () => {
    const context = buildArtistContext(
      [
        credit({ eventId: 'e1', artistId: 'a1', artistName: 'Vocalist' }),
        credit({ eventId: 'e1', artistId: 'a2', artistName: 'Violinist' }),
        credit({ eventId: 'e1', artistId: 'a3', artistName: 'Mridangist' }),
      ],
      [event({ id: 'e1' })]
    );

    expect(context.get('a1')?.performsWith).toEqual(['Violinist', 'Mridangist']);
    expect(context.get('a2')?.performsWith).toEqual(['Vocalist', 'Mridangist']);
  });

  it('ignores credits on soft-deleted events', () => {
    const context = buildArtistContext(
      [
        credit({ eventId: 'gone', artistId: 'a1', role: 'vocal' }),
        credit({ eventId: 'live', artistId: 'a1', role: 'violin' }),
      ],
      [event({ id: 'gone', deletedAt: '2026-01-01' }), event({ id: 'live' })]
    );

    expect(context.get('a1')).toMatchObject({ appearances: 1, roles: ['violin'] });
  });

  it('keeps every credited role verbatim, including ones the instrument rules refuse', () => {
    // A worker needs "chief-guest" to judge identity even though it fills no field.
    const context = buildArtistContext(
      [
        credit({ eventId: 'e1', artistId: 'a1', role: 'chief-guest' }),
        credit({ eventId: 'e2', artistId: 'a1', role: 'vocal' }),
      ],
      [event({ id: 'e1' }), event({ id: 'e2' })]
    );

    expect(context.get('a1')?.roles).toEqual(['chief-guest', 'vocal']);
  });

  it('caps the lists so a packet of 25 stays readable', () => {
    const credits = Array.from({ length: 20 }, (_, i) =>
      credit({
        eventId: `e${i}`,
        artistId: 'a1',
        eventStartDateTime: `2026-01-${String(i + 1).padStart(2, '0')}`,
      })
    );
    const events = credits.map((_, i) => event({ id: `e${i}`, venueName: `Venue ${i}` }));

    expect(buildArtistContext(credits, events).get('a1')?.venues).toHaveLength(5);
  });

  it('drops blank venues and organisers rather than emitting empty strings', () => {
    const context = buildArtistContext(
      [credit({ eventId: 'e1', artistId: 'a1' })],
      [event({ id: 'e1', venueName: '  ', organiserName: undefined })]
    );

    expect(context.get('a1')?.venues).toEqual([]);
    expect(context.get('a1')?.organisers).toEqual([]);
  });

  it('leaves out an artist whose every event is deleted', () => {
    const context = buildArtistContext(
      [credit({ eventId: 'gone', artistId: 'a1' })],
      [event({ id: 'gone', deletedAt: '2026-01-01' })]
    );

    expect(context.has('a1')).toBe(false);
  });
});

const song = (
  over: Partial<{
    composerId: string;
    title: string;
    language: string;
    ragas: Array<{ name: string }>;
    deletedAt: string;
    mergedIntoId: string;
  }>
) => ({ composerId: 'c1', title: 'x', ...over });

describe('buildComposerContext', () => {
  it('lists what a composer is credited with, romanised', () => {
    const context = buildComposerContext([
      song({ title: 'endarO mahAnubhAvulu', language: 'Telugu', ragas: [{ name: 'shrI' }] }),
      song({ title: 'nagumOmu', language: 'Telugu', ragas: [{ name: 'AbhEri' }] }),
    ]);

    expect(context.get('c1')).toEqual({
      compositions: 2,
      titles: ['endaro mahanubhavulu', 'nagumomu'],
      ragas: ['sri', 'abheri'],
      languages: ['Telugu'],
    });
  });

  it('skips deleted and merged compositions', () => {
    const context = buildComposerContext([
      song({ deletedAt: '2026-01-01' }),
      song({ mergedIntoId: 'other' }),
    ]);

    expect(context.has('c1')).toBe(false);
  });
});

describe('withComposers', () => {
  it('gives a composer with no events a context of their songs alone', () => {
    const merged = withComposers(
      new Map(),
      buildComposerContext([song({ composerId: 'c1', title: 'nagumOmu' })])
    );

    expect(merged.get('c1')?.appearances).toBe(0);
    expect(merged.get('c1')?.composes?.titles).toEqual(['nagumomu']);
  });

  it('adds the songs to a composer who also performs', () => {
    const merged = withComposers(
      buildArtistContext(
        [credit({ eventId: 'e1', artistId: 'c1', role: 'vocal' })],
        [event({ id: 'e1' })]
      ),
      buildComposerContext([song({ composerId: 'c1' })])
    );

    expect(merged.get('c1')?.roles).toEqual(['vocal']);
    expect(merged.get('c1')?.composes?.compositions).toBe(1);
  });
});
