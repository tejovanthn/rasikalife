import { Field, Input, Select } from '@rasika/ui';
import { useEffect, useId, useState } from 'react';
import { useFetcher } from 'react-router';
import { ADMIN_COPY, ADMIN_EXTRA_COPY } from '~/lib/copy';
import { filterVenues } from '~/lib/qr-admin';
import type { VenueOption } from '~/lib/qr-admin';

type SpaceOption = { spaceId: string; name: string };

/**
 * Venue typeahead plus the space list of the chosen venue.
 *
 * Without JavaScript this is a search box that does nothing and a select of every venue, so the
 * form still submits. With it, typing narrows the select, and picking a venue loads its spaces
 * from `/api/spaces`. The spaces are optional on every form that uses this.
 */
export function VenuePicker({
  venues,
  initialVenueId,
  createVenueUrl,
  error,
}: {
  venues: VenueOption[];
  initialVenueId?: string;
  createVenueUrl: string;
  error?: string | null;
}) {
  const uid = useId();
  const [query, setQuery] = useState('');
  const [venueId, setVenueId] = useState(initialVenueId ?? '');
  const fetcher = useFetcher<{ spaces: SpaceOption[] }>();

  const shown = filterVenues(venues, query, 100);
  // Keep the chosen venue in the list even when the search hides it.
  const chosen = venues.find(v => v.id === venueId);
  const options = chosen && !shown.some(v => v.id === chosen.id) ? [chosen, ...shown] : shown;

  // `load` keeps its identity between renders, so this runs only when the venue changes.
  const { load } = fetcher;
  useEffect(() => {
    if (venueId) load(`/api/spaces?venueId=${encodeURIComponent(venueId)}`);
  }, [venueId, load]);

  const spaces = venueId ? (fetcher.data?.spaces ?? []) : [];

  return (
    <>
      <Field label={ADMIN_EXTRA_COPY.venueSearch} htmlFor={`${uid}-search`}>
        <Input
          id={`${uid}-search`}
          type="search"
          value={query}
          onChange={event => setQuery(event.target.value)}
          autoComplete="off"
        />
      </Field>
      <Field label={ADMIN_COPY.assign.venue} htmlFor={`${uid}-venue`} error={error}>
        <Select
          id={`${uid}-venue`}
          name="venueId"
          required
          value={venueId}
          onChange={event => setVenueId(event.target.value)}
        >
          <option value="" disabled>
            {ADMIN_COPY.assign.venue}
          </option>
          {options.map(venue => (
            <option key={venue.id} value={venue.id}>
              {venue.name}
              {venue.city ? `, ${venue.city}` : ''}
            </option>
          ))}
        </Select>
      </Field>
      <p className="text-sm">
        <a
          className="text-primary underline"
          href={createVenueUrl}
          target="_blank"
          rel="noreferrer"
        >
          {ADMIN_EXTRA_COPY.createVenue}
        </a>
      </p>
      <Field label={ADMIN_COPY.assign.space} htmlFor={`${uid}-space`}>
        <Select id={`${uid}-space`} name="spaceId" defaultValue="" key={venueId}>
          <option value="" />
          {spaces.map(space => (
            <option key={space.spaceId} value={space.spaceId}>
              {space.name}
            </option>
          ))}
        </Select>
      </Field>
    </>
  );
}
