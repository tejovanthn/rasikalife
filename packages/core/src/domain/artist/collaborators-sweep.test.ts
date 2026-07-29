import { describe, expect, it } from 'vitest';
import { buildCollaboratorLists } from './collaborators-sweep';

const row = (
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

// Fixed so `strength`, which decays against wall-clock time, is comparable between runs.
const NOW = new Date('2026-02-01T00:00:00.000Z');

describe('buildCollaboratorLists', () => {
  it('pairs every member of a cast with every other, and never with themselves', () => {
    const result = buildCollaboratorLists(
      [
        row({ eventId: 'e1', artistId: 'a1', artistName: 'Vocalist' }),
        row({ eventId: 'e1', artistId: 'a2', artistName: 'Violinist' }),
        row({ eventId: 'e1', artistId: 'a3', artistName: 'Mridangist' }),
      ],
      NOW
    );

    expect(
      result
        .get('a1')
        ?.map(c => c.artistId)
        .sort()
    ).toEqual(['a2', 'a3']);
    expect(
      result
        .get('a2')
        ?.map(c => c.artistId)
        .sort()
    ).toEqual(['a1', 'a3']);
    expect(result.get('a1')?.some(c => c.artistId === 'a1')).toBe(false);
  });

  it('counts shared events across the whole junction, not per event', () => {
    const result = buildCollaboratorLists(
      [
        row({ eventId: 'e1', artistId: 'a1' }),
        row({ eventId: 'e1', artistId: 'a2', artistName: 'B' }),
        row({ eventId: 'e2', artistId: 'a1' }),
        row({ eventId: 'e2', artistId: 'a2', artistName: 'B' }),
        row({ eventId: 'e3', artistId: 'a1' }),
        row({ eventId: 'e3', artistId: 'a3', artistName: 'C' }),
      ],
      NOW
    );

    const edges = result.get('a1') ?? [];
    expect(edges.find(c => c.artistId === 'a2')?.sharedEventCount).toBe(2);
    expect(edges.find(c => c.artistId === 'a3')?.sharedEventCount).toBe(1);
  });

  it('keeps a solo performer out of the map entirely, so the sweep clears their old list', () => {
    const result = buildCollaboratorLists([row({ eventId: 'e1', artistId: 'a1' })], NOW);
    expect(result.get('a1')).toEqual([]);
  });

  it('does not let two artists at different events become collaborators', () => {
    const result = buildCollaboratorLists(
      [
        row({ eventId: 'e1', artistId: 'a1' }),
        row({ eventId: 'e2', artistId: 'a2', artistName: 'B' }),
      ],
      NOW
    );
    expect(result.get('a1')).toEqual([]);
    expect(result.get('a2')).toEqual([]);
  });
});

// The sweep's predecessor lived in packages/scripts and imported `collaboratorsFrom` from
// this barrel, which never re-exported it. Nothing caught that: the CLI is not unit-tested,
// and the failure only appeared after both full table scans had already run. A missing
// export is cheap to assert and was expensive to miss.
describe('the barrel exports what the CLI and the cron import', () => {
  it('exposes the sweep and its helpers', async () => {
    const barrel = await import('.');
    expect(typeof barrel.collaboratorsFrom).toBe('function');
    expect(typeof barrel.rebuildAllCollaborators).toBe('function');
    expect(typeof barrel.rebuildArtistCollaborators).toBe('function');
  });

  it('reaches them through the Artist namespace the cron uses', async () => {
    const root = await import('../../index');
    expect(typeof root.Artist.rebuildAllCollaborators).toBe('function');
    expect(typeof root.Artist.rebuildAllFeatured).toBe('function');
    expect(typeof root.Artist.rebuildAllRepertoires).toBe('function');
  });
});
