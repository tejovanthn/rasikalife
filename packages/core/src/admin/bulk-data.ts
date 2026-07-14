/**
 * Server-side registry powering the admin CSV export/import tool. For each domain it wires
 * the ElectroDB entity (for export scans) to the domain client's create/update/get functions
 * and Zod schemas (for validated imports).
 *
 * On import a row is: (1) run through a domain `prepare` hook that resolves linked-entity
 * names to ids via get-or-create; (2) validated against the create/update schema; (3) applied.
 * Each row is handled independently so one bad row never aborts the batch — failures are
 * collected and returned. Names are resolved through a per-run cache so repeated references
 * don't create duplicates.
 */
import type { ZodError, ZodTypeAny } from 'zod';
import * as Artist from '../domain/artist';
import { ArtistEntity } from '../domain/artist/entity';
import { CreateArtistSchema, UpdateArtistSchema } from '../domain/artist/schema';
import * as Award from '../domain/award';
import { AwardEntity } from '../domain/award/entity';
import { CreateAwardSchema, UpdateAwardSchema } from '../domain/award/schema';
import * as Composition from '../domain/composition';
import { CompositionEntity } from '../domain/composition/entity';
import { CreateCompositionSchema, UpdateCompositionSchema } from '../domain/composition/schema';
import * as Event from '../domain/event';
import { EventEntity } from '../domain/event/entity';
import { CreateEventSchema, UpdateEventSchema } from '../domain/event/schema';
import * as Festival from '../domain/festival';
import { FestivalEntity } from '../domain/festival/entity';
import { CreateFestivalSchema, UpdateFestivalSchema } from '../domain/festival/schema';
import * as Organiser from '../domain/organiser';
import { OrganiserEntity } from '../domain/organiser/entity';
import { CreateOrganiserSchema, UpdateOrganiserSchema } from '../domain/organiser/schema';
import * as Raga from '../domain/raga';
import { RagaEntity } from '../domain/raga/entity';
import { CreateRagaSchema, UpdateRagaSchema } from '../domain/raga/schema';
import * as Tala from '../domain/tala';
import { TalaEntity } from '../domain/tala/entity';
import { CreateTalaSchema, UpdateTalaSchema } from '../domain/tala/schema';
import * as Venue from '../domain/venue';
import { VenueEntity } from '../domain/venue/entity';
import { CreateVenueSchema, UpdateVenueSchema } from '../domain/venue/schema';

type Row = Record<string, unknown>;
type Ref = { id: string; name: string };

interface Resolvers {
  artist: (name: string) => Promise<Ref>;
  raga: (name: string) => Promise<Ref>;
  tala: (name: string) => Promise<Ref>;
  venue: (name: string) => Promise<Ref>;
  organiser: (name: string) => Promise<Ref>;
}

interface BulkContext {
  userId: string;
  resolve: Resolvers;
}

type PrepareFn = (row: Row, ctx: BulkContext) => Promise<Row>;

interface DomainConfig {
  createSchema: ZodTypeAny;
  updateSchema: ZodTypeAny;
  getById: (id: string) => Promise<unknown | null>;
  create: (input: Row, ctx: BulkContext) => Promise<unknown>;
  update: (id: string, input: Row, ctx: BulkContext) => Promise<unknown>;
  scanAll: () => Promise<Row[]>;
  prepare?: PrepareFn;
}

async function getOrCreateRef(
  cache: Map<string, Ref>,
  getByName: (name: string) => Promise<{ id: string; name: string } | null>,
  create: (name: string) => Promise<{ id: string; name: string }>,
  rawName: string
): Promise<Ref> {
  const name = rawName.trim();
  const cached = cache.get(name);
  if (cached) return cached;
  const existing = await getByName(name);
  const entity = existing ?? (await create(name));
  const ref: Ref = { id: entity.id, name: entity.name };
  cache.set(name, ref);
  return ref;
}

function createResolvers(): Resolvers {
  const caches = {
    artist: new Map<string, Ref>(),
    raga: new Map<string, Ref>(),
    tala: new Map<string, Ref>(),
    venue: new Map<string, Ref>(),
    organiser: new Map<string, Ref>(),
  };
  return {
    artist: name =>
      getOrCreateRef(
        caches.artist,
        Artist.getArtistByName,
        n => Artist.createArtist({ name: n, gurus: [] }),
        name
      ),
    raga: name =>
      getOrCreateRef(caches.raga, Raga.getRagaByName, n => Raga.createRaga({ name: n }), name),
    tala: name =>
      getOrCreateRef(caches.tala, Tala.getTalaByName, n => Tala.createTala({ name: n }), name),
    venue: name =>
      getOrCreateRef(caches.venue, Venue.getVenueByName, n => Venue.createVenue({ name: n }), name),
    organiser: name =>
      getOrCreateRef(
        caches.organiser,
        Organiser.getOrganiserByName,
        n => Organiser.createOrganiser({ name: n }),
        name
      ),
  };
}

async function idsFor(names: unknown, resolve: (name: string) => Promise<Ref>): Promise<string[]> {
  if (!Array.isArray(names)) return [];
  const refs = await Promise.all(names.map(name => resolve(String(name))));
  return refs.map(ref => ref.id);
}

const prepareArtist: PrepareFn = async row => {
  const { guruNames, ...rest } = row;
  if (Array.isArray(guruNames)) rest.gurus = guruNames.map(name => ({ name: String(name) }));
  return rest;
};

const prepareRaga: PrepareFn = async (row, ctx) => {
  const { parentRagaName, ...rest } = row;
  if (typeof parentRagaName === 'string') rest.parentRaga = await ctx.resolve.raga(parentRagaName);
  return rest;
};

const prepareComposition: PrepareFn = async (row, ctx) => {
  const { composerName, ragaNames, talaNames, ...rest } = row;
  if (typeof composerName === 'string') rest.composer = await ctx.resolve.artist(composerName);
  if (ragaNames !== undefined) rest.ragaIds = await idsFor(ragaNames, ctx.resolve.raga);
  if (talaNames !== undefined) rest.talaIds = await idsFor(talaNames, ctx.resolve.tala);
  return rest;
};

const prepareOrganiser: PrepareFn = async (row, ctx) => {
  const { venueName, ...rest } = row;
  if (typeof venueName === 'string') {
    const venue = await ctx.resolve.venue(venueName);
    rest.venueId = venue.id;
    rest.venueName = venue.name;
  }
  return rest;
};

const prepareFestival: PrepareFn = async (row, ctx) => {
  const { organiserName, ...rest } = row;
  if (typeof organiserName === 'string') {
    const organiser = await ctx.resolve.organiser(organiserName);
    rest.organiserId = organiser.id;
    rest.organiserName = organiser.name;
  }
  return rest;
};

const prepareAward: PrepareFn = async (row, ctx) => {
  const { issuingOrganisationName, ...rest } = row;
  if (typeof issuingOrganisationName === 'string') {
    const organiser = await ctx.resolve.organiser(issuingOrganisationName);
    rest.issuingOrganisationId = organiser.id;
    rest.issuingOrganisationName = organiser.name;
  }
  return rest;
};

const prepareEvent: PrepareFn = async (row, ctx) => {
  const { venueName, organiserName, artistNames, ...rest } = row;
  if (typeof venueName === 'string') {
    const venue = await ctx.resolve.venue(venueName);
    rest.venueId = venue.id;
    rest.venueName = venue.name;
  }
  if (typeof organiserName === 'string') {
    const organiser = await ctx.resolve.organiser(organiserName);
    rest.organiserId = organiser.id;
    rest.organiserName = organiser.name;
  }
  if (Array.isArray(artistNames)) {
    rest.artists = await Promise.all(artistNames.map(name => ctx.resolve.artist(String(name))));
  }
  return rest;
};

async function scanEntity(
  go: (opts: { cursor: string | null; limit: number }) => Promise<{
    data: unknown[];
    cursor: string | null;
  }>
): Promise<Row[]> {
  const items: Row[] = [];
  let cursor: string | null = null;
  do {
    const result = await go({ cursor, limit: 500 });
    items.push(...(result.data as Row[]));
    cursor = result.cursor;
  } while (cursor);
  return items.filter(item => !item.deletedAt && !item.mergedIntoId);
}

const REGISTRY: Record<string, DomainConfig> = {
  artist: {
    createSchema: CreateArtistSchema,
    updateSchema: UpdateArtistSchema,
    getById: Artist.getArtist,
    create: input => Artist.createArtist(input as Parameters<typeof Artist.createArtist>[0]),
    update: (id, input) =>
      Artist.updateArtist(id, input as Parameters<typeof Artist.updateArtist>[1]),
    scanAll: () => scanEntity(opts => ArtistEntity.scan.go(opts)),
    prepare: prepareArtist,
  },
  raga: {
    createSchema: CreateRagaSchema,
    updateSchema: UpdateRagaSchema,
    getById: Raga.getRaga,
    create: input => Raga.createRaga(input as Parameters<typeof Raga.createRaga>[0]),
    update: (id, input) => Raga.updateRaga(id, input as Parameters<typeof Raga.updateRaga>[1]),
    scanAll: () => scanEntity(opts => RagaEntity.scan.go(opts)),
    prepare: prepareRaga,
  },
  tala: {
    createSchema: CreateTalaSchema,
    updateSchema: UpdateTalaSchema,
    getById: Tala.getTala,
    create: input => Tala.createTala(input as Parameters<typeof Tala.createTala>[0]),
    update: (id, input) => Tala.updateTala(id, input as Parameters<typeof Tala.updateTala>[1]),
    scanAll: () => scanEntity(opts => TalaEntity.scan.go(opts)),
  },
  composition: {
    createSchema: CreateCompositionSchema,
    updateSchema: UpdateCompositionSchema,
    getById: Composition.getComposition,
    create: input =>
      Composition.createComposition(input as Parameters<typeof Composition.createComposition>[0]),
    update: (id, input) =>
      Composition.updateComposition(
        id,
        input as Parameters<typeof Composition.updateComposition>[1]
      ),
    scanAll: () => scanEntity(opts => CompositionEntity.scan.go(opts)),
    prepare: prepareComposition,
  },
  venue: {
    createSchema: CreateVenueSchema,
    updateSchema: UpdateVenueSchema,
    getById: Venue.getVenue,
    create: input => Venue.createVenue(input as Parameters<typeof Venue.createVenue>[0]),
    update: (id, input) => Venue.updateVenue(id, input as Parameters<typeof Venue.updateVenue>[1]),
    scanAll: () => scanEntity(opts => VenueEntity.scan.go(opts)),
  },
  organiser: {
    createSchema: CreateOrganiserSchema,
    updateSchema: UpdateOrganiserSchema,
    getById: Organiser.getOrganiser,
    create: input =>
      Organiser.createOrganiser(input as Parameters<typeof Organiser.createOrganiser>[0]),
    update: (id, input) =>
      Organiser.updateOrganiser(id, input as Parameters<typeof Organiser.updateOrganiser>[1]),
    scanAll: () => scanEntity(opts => OrganiserEntity.scan.go(opts)),
    prepare: prepareOrganiser,
  },
  festival: {
    createSchema: CreateFestivalSchema,
    updateSchema: UpdateFestivalSchema,
    getById: Festival.getFestival,
    create: (input, ctx) =>
      Festival.createFestival(input as Parameters<typeof Festival.createFestival>[0], ctx.userId),
    update: (id, input) =>
      Festival.updateFestival(id, input as Parameters<typeof Festival.updateFestival>[1]),
    scanAll: () => scanEntity(opts => FestivalEntity.scan.go(opts)),
    prepare: prepareFestival,
  },
  award: {
    createSchema: CreateAwardSchema,
    updateSchema: UpdateAwardSchema,
    getById: Award.getAward,
    create: input => Award.createAward(input as Parameters<typeof Award.createAward>[0]),
    update: (id, input) => Award.updateAward(id, input as Parameters<typeof Award.updateAward>[1]),
    scanAll: () => scanEntity(opts => AwardEntity.scan.go(opts)),
    prepare: prepareAward,
  },
  event: {
    createSchema: CreateEventSchema,
    updateSchema: UpdateEventSchema,
    getById: Event.getEvent,
    create: (input, ctx) =>
      Event.createEvent(input as Parameters<typeof Event.createEvent>[0], ctx.userId),
    update: (id, input) =>
      Event.updateApprovedEvent(id, input as Parameters<typeof Event.updateApprovedEvent>[1]),
    scanAll: () => scanEntity(opts => EventEntity.scan.go(opts)),
    prepare: prepareEvent,
  },
};

export const BULK_DOMAIN_KEYS = Object.keys(REGISTRY);

export function isBulkDomain(domain: string): boolean {
  return domain in REGISTRY;
}

export interface BulkUpsertResult {
  created: number;
  updated: number;
  errors: Array<{ index: number; name?: string; message: string }>;
}

function formatZodError(error: ZodError): string {
  return error.issues
    .map(issue => `${issue.path.join('.') || 'value'}: ${issue.message}`)
    .join('; ');
}

export async function listAllForDomain(domain: string): Promise<Row[]> {
  const config = REGISTRY[domain];
  if (!config) throw new Error(`Unknown bulk domain: ${domain}`);
  return config.scanAll();
}

export async function bulkUpsertForDomain(
  domain: string,
  rows: Row[],
  userId: string
): Promise<BulkUpsertResult> {
  const config = REGISTRY[domain];
  if (!config) throw new Error(`Unknown bulk domain: ${domain}`);

  const ctx: BulkContext = { userId, resolve: createResolvers() };
  const result: BulkUpsertResult = { created: 0, updated: 0, errors: [] };

  for (let index = 0; index < rows.length; index++) {
    const { id: rawId, ...fields } = rows[index];
    const id = typeof rawId === 'string' && rawId.trim() ? rawId.trim() : undefined;
    const name =
      typeof fields.name === 'string'
        ? fields.name
        : typeof fields.title === 'string'
          ? fields.title
          : undefined;

    try {
      const prepared = config.prepare ? await config.prepare(fields, ctx) : fields;

      if (id) {
        const existing = await config.getById(id);
        if (!existing) {
          result.errors.push({ index, name, message: `${domain} with id "${id}" not found` });
          continue;
        }
        const parsed = config.updateSchema.safeParse(prepared);
        if (!parsed.success) {
          result.errors.push({ index, name, message: formatZodError(parsed.error) });
          continue;
        }
        await config.update(id, parsed.data, ctx);
        result.updated++;
      } else {
        const parsed = config.createSchema.safeParse(prepared);
        if (!parsed.success) {
          result.errors.push({ index, name, message: formatZodError(parsed.error) });
          continue;
        }
        await config.create(parsed.data, ctx);
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
