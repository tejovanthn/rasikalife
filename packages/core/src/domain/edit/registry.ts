import type { z } from 'zod';
import type { Artist } from '../artist';
import type { Composition, CompositionWithRelations } from '../composition';
import type { Event } from '../event/entity';
import type { Organiser } from '../organiser/entity';
import type { Raga } from '../raga';
import type { Tala } from '../tala';
import type { Venue } from '../venue/entity';
import type { EditEntityType } from './types';

export type GetEntityFunction<T = unknown> = (id: string) => Promise<T | null>;
export type UpdateEntityFunction<T = unknown> = (id: string, input: unknown) => Promise<T>;
export type DeleteEntityFunction = (id: string) => Promise<void>;

export interface EditHandler {
  getEntity: GetEntityFunction;
  updateEntity: UpdateEntityFunction;
  deleteEntity: DeleteEntityFunction;
  updateSchema: z.ZodType;
}

async function getCompositionHandler() {
  const mod = await import('../composition');
  return {
    getEntity: mod.getComposition as GetEntityFunction<CompositionWithRelations>,
    updateEntity: mod.updateComposition as UpdateEntityFunction<Composition>,
    deleteEntity: mod.softDeleteComposition as DeleteEntityFunction,
    updateSchema: (await import('../composition/schema')).UpdateCompositionSchema,
  };
}

async function getArtistHandler() {
  const mod = await import('../artist');
  return {
    getEntity: mod.getArtist as GetEntityFunction<Artist>,
    updateEntity: mod.updateArtist as UpdateEntityFunction<Artist>,
    deleteEntity: mod.softDeleteArtist as DeleteEntityFunction,
    updateSchema: (await import('../artist/schema')).UpdateArtistSchema,
  };
}

async function getRagaHandler() {
  const mod = await import('../raga');
  return {
    getEntity: mod.getRaga as GetEntityFunction<Raga>,
    updateEntity: mod.updateRaga as UpdateEntityFunction<Raga>,
    deleteEntity: mod.softDeleteRaga as DeleteEntityFunction,
    updateSchema: (await import('../raga/schema')).UpdateRagaSchema,
  };
}

async function getTalaHandler() {
  const mod = await import('../tala');
  return {
    getEntity: mod.getTala as GetEntityFunction<Tala>,
    updateEntity: mod.updateTala as UpdateEntityFunction<Tala>,
    deleteEntity: mod.softDeleteTala as DeleteEntityFunction,
    updateSchema: (await import('../tala/schema')).UpdateTalaSchema,
  };
}

async function getVenueHandler() {
  const mod = await import('../venue');
  return {
    getEntity: mod.getVenue as GetEntityFunction<Venue>,
    updateEntity: mod.updateVenue as UpdateEntityFunction<Venue>,
    deleteEntity: mod.softDeleteVenue as DeleteEntityFunction,
    updateSchema: (await import('../venue/schema')).UpdateVenueSchema,
  };
}

async function getOrganiserHandler() {
  const mod = await import('../organiser');
  return {
    getEntity: mod.getOrganiser as GetEntityFunction<Organiser>,
    updateEntity: mod.updateOrganiser as UpdateEntityFunction<Organiser>,
    deleteEntity: mod.softDeleteOrganiser as DeleteEntityFunction,
    updateSchema: (await import('../organiser/schema')).UpdateOrganiserSchema,
  };
}

async function getEventHandler() {
  const mod = await import('../event');
  return {
    getEntity: mod.getEvent as GetEntityFunction<Event>,
    updateEntity: mod.updateApprovedEvent as UpdateEntityFunction<Event>,
    deleteEntity: mod.softDeleteEvent as DeleteEntityFunction,
    updateSchema: (await import('../event/schema')).UpdateEventSchema,
  };
}

const handlerCache: Partial<Record<EditEntityType, EditHandler>> = {};

export async function getHandler(entityType: EditEntityType): Promise<EditHandler> {
  if (handlerCache[entityType]) {
    return handlerCache[entityType] as EditHandler;
  }

  let handler: EditHandler;
  switch (entityType) {
    case 'composition':
      handler = await getCompositionHandler();
      break;
    case 'artist':
      handler = await getArtistHandler();
      break;
    case 'raga':
      handler = await getRagaHandler();
      break;
    case 'tala':
      handler = await getTalaHandler();
      break;
    case 'venue':
      handler = await getVenueHandler();
      break;
    case 'organiser':
      handler = await getOrganiserHandler();
      break;
    case 'event':
      handler = await getEventHandler();
      break;
    default:
      throw new Error(`No handler registered for entity type: ${entityType}`);
  }

  handlerCache[entityType] = handler;
  return handler;
}
