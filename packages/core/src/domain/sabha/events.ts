import { z } from 'zod';
import { ApplicationError, ErrorCode } from '../../constants';
import { getArtistByName } from '../artist';
import { createDraft, getActiveEditForEntity, submitEdit, withdrawEdit } from '../edit/service';
import {
  approveEvent,
  createEvent,
  findLikelyDuplicatesOfEvent,
  getEvent,
  submitEvent,
  updateApprovedEvent,
  updateEvent,
} from '../event';
import { EventEntity } from '../event/entity';
import type { Event } from '../event/entity';
import { getOrganiser } from '../organiser';
import { getPartnerMember } from '../partner-member';
import { getVenue } from '../venue';
import {
  CalendarDateSchema,
  ClockTimeSchema,
  concertStart,
  mayAutoApprove,
  parseArtistNames,
} from '../venue-qr/add-concert';
import { DEFAULT_TIMEZONE } from '../venue-qr/constants';
import { getSpace } from '../venue-space';
import { mergeOwnerCast } from './cast';

/**
 * The owner's event form. Fields are the Copy tab's "Add a concert" labels (Title, Date, Start
 * time, Space, Artists, Notes) plus the venue. The organiser is the dashboard's own, never typed.
 */
export const OwnerEventSchema = z.object({
  organiserId: z.string(),
  title: z.string().trim().min(1).max(300),
  /** `YYYY-MM-DD`, the day at the hall. */
  date: CalendarDateSchema,
  /** `HH:mm` on the hall's wall clock. */
  startTime: ClockTimeSchema,
  venueId: z.string().optional(),
  spaceId: z.string().optional(),
  /** One name per line or comma-separated. */
  artists: z.string().max(1000).optional(),
  notes: z.string().trim().max(2000).optional(),
});

export const UpdateOwnerEventSchema = OwnerEventSchema.extend({ eventId: z.string() });

export type OwnerEventInput = z.infer<typeof OwnerEventSchema>;

async function requireOwnedOrganiser(organiserId: string, userId: string) {
  const organiser = await getOrganiser(organiserId);
  if (!organiser || organiser.mergedIntoId) {
    throw new ApplicationError(ErrorCode.ORGANISER_NOT_FOUND, `Organiser ${organiserId} not found`);
  }
  const membership = await getPartnerMember(userId, 'organiser', organiserId);
  return { organiser, membership };
}

/** One billed name, matched to an existing artist by exact name. Never creates an artist. */
async function resolveArtist(name: string) {
  const found = await getArtistByName(name).catch(() => null);
  return found ? { id: found.id, name: found.name } : { name };
}

/** Billed names for a new event. */
async function resolveArtists(text?: string) {
  return Promise.all(parseArtistNames(text).map(({ name }) => resolveArtist(name)));
}

async function resolveVenueAndSpace(venueId?: string, spaceId?: string) {
  if (!venueId) return { venue: null, space: null };
  const venue = await getVenue(venueId);
  const canonical = venue?.mergedIntoId ? await getVenue(venue.mergedIntoId) : venue;
  if (!canonical || canonical.deletedAt) {
    throw new ApplicationError(ErrorCode.VENUE_NOT_FOUND, `Venue ${venueId} not found`);
  }
  const space = spaceId ? await getSpace(canonical.id, spaceId) : null;
  if (spaceId && !space) {
    throw new ApplicationError(ErrorCode.SPACE_NOT_FOUND, `Space ${spaceId} not found`);
  }
  return { venue: canonical, space };
}

/**
 * An owner adds a concert for their own organiser. It is published at once (the organiser is a
 * trusted source) when the organiser is verified and a moderator has not turned review on
 * (`mayAutoApprove`). Otherwise it goes to the moderator queue as `submitted`. A published event
 * carries `ownerPublishedAt`, which feeds the moderator spot-check feed.
 */
export async function createOwnerEvent(
  input: OwnerEventInput,
  userId: string,
  now: Date = new Date()
): Promise<{ eventId: string; published: boolean; heldAsDuplicate?: boolean }> {
  const { organiser, membership } = await requireOwnedOrganiser(input.organiserId, userId);
  const { venue, space } = await resolveVenueAndSpace(input.venueId, input.spaceId);

  const draft = await createEvent(
    {
      title: input.title,
      startDateTime: concertStart(input.date, input.startTime),
      timezone: DEFAULT_TIMEZONE,
      ...(venue
        ? {
            venueId: venue.id,
            venueName: venue.name,
            ...(venue.city ? { venueCity: venue.city } : {}),
          }
        : {}),
      ...(space ? { spaceId: space.spaceId, spaceName: space.name } : {}),
      organiserId: organiser.id,
      organiserName: organiser.name,
      artists: await resolveArtists(input.artists),
      ...(input.notes ? { description: input.notes } : {}),
      tags: [],
      entryType: 'free',
    },
    userId,
    { status: 'draft' }
  );
  const submitted = await submitEvent(draft.id, {}, userId);

  if (!mayAutoApprove(membership, organiser)) {
    return { eventId: submitted.id, published: false };
  }
  // A likely duplicate is never auto-published. It stays `submitted`, and the moderator queue
  // shows it with the "Possible duplicate" line.
  const duplicates = await findLikelyDuplicatesOfEvent(submitted);
  if (duplicates.length > 0) {
    return { eventId: submitted.id, published: false, heldAsDuplicate: true };
  }
  const approved = await approveEvent(submitted.id, userId);
  await EventEntity.patch({ id: approved.id }).set({ ownerPublishedAt: now.toISOString() }).go();
  return { eventId: approved.id, published: true };
}

/**
 * An owner edits one of their organiser's events. The event must name this organiser: an owner
 * of one sabha cannot touch another's concert by guessing an id. Fields the form does not carry
 * (poster, ticketing, festival) are left alone.
 *
 * When a moderator has turned review on (`requireEventReview`) and the event is already approved,
 * nothing is written to the live event (owner decision 13). The change goes through the Edit
 * workflow as a submitted edit, the same path wiki edits to events use, and the live event stays
 * as it is until a moderator approves. An earlier edit of this owner still waiting is withdrawn
 * first, so the queue holds one. A cleared space or city cannot be a proposed value, so it
 * travels as `clearFields`, which approval removes with `.remove()` (see `edit/registry.ts`).
 * With the switch off, edits stay instant.
 */
export async function updateOwnerEvent(
  input: z.infer<typeof UpdateOwnerEventSchema>,
  userId: string
): Promise<{ event: Event; sentToReview: boolean }> {
  const { organiser } = await requireOwnedOrganiser(input.organiserId, userId);
  const existing = await getEvent(input.eventId);
  if (!existing || existing.organiserId !== input.organiserId) {
    throw new ApplicationError(ErrorCode.EVENT_NOT_FOUND, `Event ${input.eventId} not found`);
  }
  const { venue, space } = await resolveVenueAndSpace(input.venueId, input.spaceId);

  // `artists` undefined means the form did not send the field: leave the cast alone. Otherwise
  // merge the typed names onto the stored cast, which keeps each stored entry's id, role and
  // title. Nothing is written when the names are the ones already stored.
  const cast =
    input.artists === undefined
      ? null
      : await mergeOwnerCast(
          existing.artists ?? [],
          parseArtistNames(input.artists),
          resolveArtist
        );

  const changes = {
    title: input.title,
    startDateTime: concertStart(input.date, input.startTime, existing.timezone),
    ...(venue
      ? {
          venueId: venue.id,
          venueName: venue.name,
          ...(venue.city ? { venueCity: venue.city } : {}),
        }
      : {}),
    ...(space ? { spaceId: space.spaceId, spaceName: space.name } : {}),
    ...(cast ? { artists: cast } : {}),
    ...(input.notes !== undefined ? { description: input.notes } : {}),
  };
  // `.set()` cannot clear an attribute (rule 8), so a cleared space and a city the new venue
  // does not have are removed with `.remove()`.
  const toRemove: Array<'spaceId' | 'spaceName' | 'venueCity'> = [];
  if (!space) {
    if (existing.spaceId) toRemove.push('spaceId');
    if (existing.spaceName) toRemove.push('spaceName');
  }
  if (venue && !venue.city && existing.venueCity) toRemove.push('venueCity');

  if (existing.status === 'approved' && organiser.requireEventReview) {
    const waiting = await getActiveEditForEntity(userId, 'event', input.eventId);
    if (waiting) await withdrawEdit(waiting.id, userId);
    const draft = await createDraft({
      entityType: 'event',
      entityId: input.eventId,
      userId,
      proposedValues: toRemove.length > 0 ? { ...changes, clearFields: toRemove } : changes,
    });
    await submitEdit(draft.id, userId);
    return { event: existing, sentToReview: true };
  }

  const saved =
    existing.status === 'approved'
      ? await updateApprovedEvent(input.eventId, changes)
      : await updateEvent(input.eventId, changes);

  if (toRemove.length === 0) return { event: saved, sentToReview: false };
  const cleared = await EventEntity.patch({ id: input.eventId })
    .remove(toRemove)
    .go({ response: 'all_new' });
  return { event: (cleared.data as Event | undefined) ?? saved, sentToReview: false };
}
