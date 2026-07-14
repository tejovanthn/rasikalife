import type { z } from 'zod';
import { generateId } from '../../utils';
import { cascadeVenueMerge, cascadeVenueNameUpdate } from '../cascade';
import { createFailedError, notFoundError } from '../helpers';
import { VenueEntity } from './entity';
import type { Venue } from './entity';
import { CreateVenueSchema, UpdateVenueSchema } from './schema';

export type CreateVenueInput = z.infer<typeof CreateVenueSchema>;
export type UpdateVenueInput = z.infer<typeof UpdateVenueSchema>;

export async function createVenue(input: CreateVenueInput): Promise<Venue> {
  const id = generateId();
  const result = await VenueEntity.create({
    id,
    ...input,
    city: input.address?.city,
  }).go();

  if (!result.data) {
    throw createFailedError('venue', input.name);
  }

  return result.data as Venue;
}

export async function getVenue(id: string): Promise<Venue | null> {
  const result = await VenueEntity.get({ id }).go();

  if (!result.data) {
    return null;
  }

  if (result.data.deletedAt && !result.data.mergedIntoId) {
    return null;
  }

  return result.data as Venue;
}

export async function getVenueByName(name: string): Promise<Venue | null> {
  const result = await VenueEntity.query.byName({ name }).go();
  const venue = result.data?.[0];
  if (!venue) return null;
  if (venue.deletedAt && !venue.mergedIntoId) return null;
  if (venue.mergedIntoId) return getVenue(venue.mergedIntoId);
  return venue as Venue;
}

export async function updateVenue(id: string, input: UpdateVenueInput): Promise<Venue> {
  const current = await getVenue(id);

  const updateData = input.address?.city ? { ...input, city: input.address.city } : input;
  const result = await VenueEntity.update({ id }).set(updateData).go({ response: 'all_new' });

  if (!result.data) {
    throw notFoundError('venue', id);
  }

  if (input.name && current && input.name !== current.name) {
    await cascadeVenueNameUpdate(id, input.name);
  }

  return result.data as Venue;
}

export async function deleteVenue(id: string): Promise<void> {
  await VenueEntity.delete({ id }).go();
}

export async function softDeleteVenue(id: string): Promise<void> {
  await VenueEntity.update({ id }).set({ deletedAt: new Date().toISOString() }).go();
}

export async function listVenues(params?: { limit?: number; nextToken?: string }): Promise<{
  items: Venue[];
  nextToken?: string;
  hasMore: boolean;
}> {
  const limit = params?.limit || 20;

  const result = await VenueEntity.query
    .list({})
    .where((attr, op) => op.notExists(attr.deletedAt))
    .go({
      limit,
      cursor: params?.nextToken,
    });

  return {
    items: result.data || [],
    nextToken: result.cursor || undefined,
    hasMore: !!result.cursor,
  };
}

export async function listVenuesByCity(
  city: string,
  params?: { limit?: number; nextToken?: string }
): Promise<{
  items: Venue[];
  nextToken?: string;
  hasMore: boolean;
}> {
  const limit = params?.limit || 20;

  const result = await VenueEntity.query
    .byCity({ city })
    .where((attr, op) => op.notExists(attr.deletedAt))
    .go({
      limit,
      cursor: params?.nextToken,
    });

  return {
    items: result.data || [],
    nextToken: result.cursor || undefined,
    hasMore: !!result.cursor,
  };
}

export async function listAllVenues(): Promise<Venue[]> {
  const venues: Venue[] = [];
  let nextToken: string | undefined;

  do {
    const page = await listVenues({ limit: 100, nextToken });
    venues.push(...page.items);
    nextToken = page.nextToken;
  } while (nextToken);

  return venues;
}

export interface BulkUpsertVenuesResult {
  created: number;
  updated: number;
  errors: Array<{ index: number; name?: string; message: string }>;
}

function formatValidationError(error: z.ZodError): string {
  return error.issues
    .map(issue => `${issue.path.join('.') || 'value'}: ${issue.message}`)
    .join('; ');
}

/**
 * Upsert a batch of venues, typically from a re-uploaded CSV export. Rows with an
 * existing `id` are updated in place; rows without one are created. Each row is
 * validated independently so a single bad row never aborts the whole batch — its
 * failure is collected in `errors` and the rest continue.
 */
export async function bulkUpsertVenues(
  rows: Array<Record<string, unknown>>
): Promise<BulkUpsertVenuesResult> {
  const result: BulkUpsertVenuesResult = { created: 0, updated: 0, errors: [] };

  for (let index = 0; index < rows.length; index++) {
    const { id: rawId, ...fields } = rows[index];
    const id = typeof rawId === 'string' && rawId.trim() ? rawId.trim() : undefined;
    const name = typeof fields.name === 'string' ? fields.name : undefined;

    try {
      if (id) {
        const existing = await getVenue(id);
        if (!existing) {
          result.errors.push({ index, name, message: `Venue with id "${id}" not found` });
          continue;
        }
        const parsed = UpdateVenueSchema.safeParse(fields);
        if (!parsed.success) {
          result.errors.push({ index, name, message: formatValidationError(parsed.error) });
          continue;
        }
        await updateVenue(id, parsed.data);
        result.updated++;
      } else {
        const parsed = CreateVenueSchema.safeParse(fields);
        if (!parsed.success) {
          result.errors.push({ index, name, message: formatValidationError(parsed.error) });
          continue;
        }
        await createVenue(parsed.data);
        result.created++;
      }
    } catch (error) {
      result.errors.push({
        index,
        name,
        message: error instanceof Error ? error.message : String(error),
      });
    }
  }

  return result;
}

export async function mergeVenue(loserId: string, canonicalId: string): Promise<void> {
  const canonical = await getVenue(canonicalId);
  if (!canonical) throw notFoundError('venue', canonicalId);
  const loser = await VenueEntity.get({ id: loserId }).go();
  if (!loser.data) throw notFoundError('venue', loserId);

  await cascadeVenueMerge(loserId, canonicalId, canonical.name);
  await VenueEntity.update({ id: loserId })
    .set({ deletedAt: new Date().toISOString(), mergedIntoId: canonicalId })
    .go();

  const loserName = loser.data.name;
  const existing = (canonical.alternateNames || []) as string[];
  if (!existing.includes(loserName)) {
    await VenueEntity.update({ id: canonicalId })
      .set({ alternateNames: [...existing, loserName] })
      .go();
  }
}

export async function getVenueMergeScore(id: string): Promise<number> {
  const { EventEntity } = await import('../event/entity');

  const [eventResult, venue] = await Promise.all([
    EventEntity.query.byVenue({ venueId: id }).go({ attributes: ['id'] as never[] }),
    VenueEntity.get({ id }).go(),
  ]);

  let score = (eventResult.data || []).length;
  if (venue.data) {
    if (venue.data.address?.street) score += 1;
    if (venue.data.address?.city) score += 1;
    if (venue.data.address?.state) score += 1;
    if (venue.data.mapLink) score += 1;
  }
  return score;
}

export type { Venue } from './entity';
export { CreateVenueSchema, UpdateVenueSchema } from './schema';
