import type { z } from 'zod';
import { generateId } from '../../utils';
import { createFailedError, notFoundError } from '../helpers';
import { OrganiserEntity } from './entity';
import type { Organiser } from './entity';
import type { CreateOrganiserSchema, UpdateOrganiserSchema } from './schema';

export type CreateOrganiserInput = z.infer<typeof CreateOrganiserSchema>;
export type UpdateOrganiserInput = z.infer<typeof UpdateOrganiserSchema>;

export async function createOrganiser(input: CreateOrganiserInput): Promise<Organiser> {
  const id = generateId();
  const result = await OrganiserEntity.create({
    id,
    ...input,
  }).go();

  if (!result.data) {
    throw createFailedError('organiser', input.name);
  }

  return result.data as Organiser;
}

export async function getOrganiser(id: string): Promise<Organiser | null> {
  const result = await OrganiserEntity.get({ id }).go();

  if (!result.data) {
    return null;
  }

  return result.data as Organiser;
}

export async function getOrganiserByName(name: string): Promise<Organiser | null> {
  const result = await OrganiserEntity.query.byName({ name }).go();
  return result.data?.[0] || null;
}

export async function updateOrganiser(id: string, input: UpdateOrganiserInput): Promise<Organiser> {
  const result = await OrganiserEntity.update({ id }).set(input).go();

  if (!result.data) {
    throw notFoundError('organiser', id);
  }

  return result.data as Organiser;
}

export async function deleteOrganiser(id: string): Promise<void> {
  await OrganiserEntity.delete({ id }).go();
}

export async function listOrganisers(params?: {
  limit?: number;
  nextToken?: string;
}): Promise<{
  items: Organiser[];
  nextToken?: string;
  hasMore: boolean;
}> {
  const limit = params?.limit || 20;

  const result = await OrganiserEntity.query.list({}).go({
    limit,
    cursor: params?.nextToken,
  });

  return {
    items: result.data || [],
    nextToken: result.cursor || undefined,
    hasMore: !!result.cursor,
  };
}

export type { Organiser } from './entity';
export { CreateOrganiserSchema, UpdateOrganiserSchema } from './schema';
