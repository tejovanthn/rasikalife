import { Button, Field, Input, Select, Textarea } from '@rasika/ui';
import { useEffect, useId, useState } from 'react';
import { Form, useFetcher, useNavigation } from 'react-router';
import { SABHA_COPY, SABHA_EXTRA_COPY } from '~/lib/copy';
import type { EventFormValues } from '~/lib/sabha';
import { FormError } from './shell';

type SpaceOption = { spaceId: string; name: string };
export type VenueOption = { id: string; name: string; city: string | null };

/**
 * The owner's Add and Edit concert form. Labels are the Copy tab's. The Space list follows the
 * chosen venue (`/api/spaces`); without JavaScript the list stays empty and the concert is
 * saved without a hall, which is allowed. Date and Start time are the hall's wall clock.
 */
export function EventForm({
  targetType,
  targetId,
  venues,
  initial,
  initialSpaces = [],
  submitLabel,
  error,
}: {
  targetType: string;
  targetId: string;
  venues: VenueOption[];
  initial?: Partial<EventFormValues>;
  initialSpaces?: SpaceOption[];
  submitLabel: string;
  error?: string | null;
}) {
  const uid = useId();
  const navigation = useNavigation();
  const [venueId, setVenueId] = useState(initial?.venueId ?? '');
  const fetcher = useFetcher<{ spaces: SpaceOption[] }>();

  // `load` keeps its identity between renders, so this runs only when the venue changes.
  const { load } = fetcher;
  useEffect(() => {
    if (venueId && venueId !== initial?.venueId) {
      load(
        `/api/spaces?targetType=${encodeURIComponent(targetType)}&targetId=${encodeURIComponent(targetId)}&venueId=${encodeURIComponent(venueId)}`
      );
    }
  }, [venueId, initial?.venueId, targetType, targetId, load]);

  const spaces = fetcher.data?.spaces ?? (venueId === initial?.venueId ? initialSpaces : []);
  const f = SABHA_COPY.addConcert.fields;

  return (
    <Form method="post" className="max-w-xl space-y-4">
      <Field label={f.title} htmlFor={`${uid}-title`}>
        <Input id={`${uid}-title`} name="title" defaultValue={initial?.title} required />
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label={f.date} htmlFor={`${uid}-date`}>
          <Input id={`${uid}-date`} name="date" type="date" defaultValue={initial?.date} required />
        </Field>
        <Field label={f.startTime} htmlFor={`${uid}-time`}>
          <Input
            id={`${uid}-time`}
            name="startTime"
            type="time"
            defaultValue={initial?.startTime}
            required
          />
        </Field>
      </div>
      <Field label={SABHA_COPY.venue} htmlFor={`${uid}-venue`}>
        <Select
          id={`${uid}-venue`}
          name="venueId"
          required
          value={venueId}
          onChange={event => setVenueId(event.target.value)}
        >
          <option value="" disabled>
            {SABHA_COPY.venue}
          </option>
          {venues.map(venue => (
            <option key={venue.id} value={venue.id}>
              {venue.name}
              {venue.city ? `, ${venue.city}` : ''}
            </option>
          ))}
        </Select>
      </Field>
      <Field label={f.space} htmlFor={`${uid}-space`}>
        <Select
          id={`${uid}-space`}
          name="spaceId"
          defaultValue={initial?.spaceId ?? ''}
          key={`${venueId}:${spaces.length}`}
        >
          <option value="">{SABHA_EXTRA_COPY.eventsNoSpace}</option>
          {spaces.map(space => (
            <option key={space.spaceId} value={space.spaceId}>
              {space.name}
            </option>
          ))}
        </Select>
      </Field>
      <Field label={f.artists} htmlFor={`${uid}-artists`} hint={SABHA_EXTRA_COPY.eventsArtistsHint}>
        <Textarea id={`${uid}-artists`} name="artists" defaultValue={initial?.artists} />
      </Field>
      <Field label={f.notes} htmlFor={`${uid}-notes`}>
        <Textarea id={`${uid}-notes`} name="notes" defaultValue={initial?.notes} />
      </Field>
      <FormError>{error}</FormError>
      <Button type="submit" pending={navigation.state === 'submitting'}>
        {submitLabel}
      </Button>
    </Form>
  );
}
