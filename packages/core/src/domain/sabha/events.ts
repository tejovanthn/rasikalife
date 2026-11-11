import { z } from 'zod';
import { ApplicationError, ErrorCode } from '../../constants';
import { getArtistByName } from '../artist';
import {
  approveEvent,
  createEvent,
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
import { concertStart, mayAutoApprove, parseArtistNames } from '../venue-qr/add-concert';
import { DEFAULT_TIMEZONE } from '../venue-qr/constants';
import { getSpace } from '../venue-space';

/**
 * The owner's event form. Fields are the Copy tab's "Add a concert" labels (Title, Date, Start
 * time, Space, Artists, Notes) plus the venue. The organiser is the dashboard's own, never typed.
 */
export const OwnerEventSchema = z.object({
  organiserId: z.string(),
  title: z.string().trim().min(1).max(300),
  /** `YYYY-MM-DD`, the day at the hall. */
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  /** `HH:mm` on the hall's wall clock. */
  startTime: z.string().regex(/^\d{2}:\d{2}$/),
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

/** Billed names, matched to an existing artist by exact name. An artist is never created here. */
async function resolveArtists(text?: string) {
  const names = parseArtistNames(text);
  return Promise.all(
    names.map(async ({ name }) => {
      const found = await getArtistByName(name).catch(() => null);
      return found ? { id: found.id, name: found.name } : { name };
    })
  );
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
): Promise<{ eventId: string; published: boolean }> {
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
  const approved = await approveEvent(submitted.id, userId);
  await EventEntity.patch({ id: approved.id }).set({ ownerPublishedAt: now.toISOString() }).go();
  return { eventId: approved.id, published: true };
}

/**
 * An owner edits one of their organiser's events. The event must name this organiser: an owner
 * of one sabha cannot touch another's concert by guessing an id. Fields the form does not carry
 * (poster, ticketing, festival) are left alone.
 *
 * TODO(spec): when a moderator has turned review on, an edit to an already approved event still
 * applies at once. Sending it back to review would take a live concert off the site over a typo.
 */
export async function updateOwnerEvent(
  input: z.infer<typeof UpdateOwnerEventSchema>,
  userId: string
): Promise<Event> {
  await requireOwnedOrganiser(input.organiserId, userId);
  const existing = await getEvent(input.eventId);
  if (!existing || existing.organiserId !== input.organiserId) {
    throw new ApplicationError(ErrorCode.EVENT_NOT_FOUND, `Event ${input.eventId} not found`);
  }
  const { venue, space } = await resolveVenueAndSpace(input.venueId, input.spaceId);

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
    artists: await resolveArtists(input.artists),
    ...(input.notes !== undefined ? { description: input.notes } : {}),
  };
  return existing.status === 'approved'
    ? updateApprovedEvent(input.eventId, changes)
    : updateEvent(input.eventId, changes);
}
