import { InvokeCommand, LambdaClient } from '@aws-sdk/client-lambda';
import { Artist, Auth, Event, Festival, Organiser, Search, Venue } from '@rasika/core';
import { ApplicationError, ErrorCode } from '@rasika/core/constants';
import { TRPCError } from '@trpc/server';
import { z } from 'zod';
import { triggerReindex } from '../reindex';
import { createTRPCRouter, editorProcedure, moderatorProcedure, publicProcedure } from '../trpc';

const lambdaClient = new LambdaClient({});

export const eventRouter = createTRPCRouter({
  // === QUERIES ===

  get: publicProcedure.input(z.object({ id: z.string().min(1) })).query(async ({ input, ctx }) => {
    const event = await Event.getEvent(input.id);
    if (!event || event.status !== 'approved') {
      const h = ctx.event.headers;
      console.warn(
        `event.get not found [id=${input.id}] status=${event?.status ?? 'missing'} ua="${h['user-agent'] ?? '-'}" referer="${h.referer ?? '-'}"`
      );
      throw new TRPCError({
        code: 'NOT_FOUND',
        message: 'Event not found',
        cause: new ApplicationError(ErrorCode.EVENT_NOT_FOUND, 'Event not found'),
      });
    }
    return event;
  }),

  getDraft: editorProcedure.input(z.object({ id: z.string().min(1) })).query(async ({ input }) => {
    const event = await Event.getEvent(input.id);
    if (!event) {
      throw new TRPCError({
        code: 'NOT_FOUND',
        message: 'Draft event not found',
        cause: new ApplicationError(ErrorCode.EVENT_NOT_FOUND, 'Draft event not found'),
      });
    }
    return event;
  }),

  listUpcoming: publicProcedure
    .input(
      z
        .object({
          limit: z.number().min(1).max(100).optional(),
          nextToken: z.string().optional(),
        })
        .optional()
    )
    .query(({ input }) => Event.listUpcomingEvents(input)),

  listPast: publicProcedure
    .input(
      z
        .object({
          limit: z.number().min(1).max(100).optional(),
          nextToken: z.string().optional(),
        })
        .optional()
    )
    .query(({ input }) => Event.listPastEvents(input)),

  byFestival: publicProcedure
    .input(
      z.object({
        festivalId: z.string().min(1),
        limit: z.number().min(1).max(100).optional(),
        nextToken: z.string().optional(),
      })
    )
    .query(({ input }) => Event.listEventsByFestival(input.festivalId, input)),

  byVenue: publicProcedure
    .input(
      z.object({
        venueId: z.string().min(1),
        limit: z.number().min(1).max(100).optional(),
        nextToken: z.string().optional(),
      })
    )
    .query(({ input }) => Event.listEventsByVenue(input.venueId, input)),

  byOrganiser: publicProcedure
    .input(
      z.object({
        organiserId: z.string().min(1),
        limit: z.number().min(1).max(100).optional(),
        nextToken: z.string().optional(),
      })
    )
    .query(({ input }) => Event.listEventsByOrganiser(input.organiserId, input)),

  byArtist: publicProcedure
    .input(
      z.object({
        artistId: z.string().min(1),
        limit: z.number().min(1).max(100).optional(),
        nextToken: z.string().optional(),
      })
    )
    .query(({ input }) => Event.listEventsByArtist(input.artistId, input)),

  listByMonth: publicProcedure
    .input(z.object({ yearMonth: z.string().regex(/^\d{4}-\d{2}$/) }))
    .query(({ input }) => Event.listApprovedEventsByMonth(input.yearMonth)),

  byArtForm: publicProcedure
    .input(
      z.object({
        artForm: z.string().min(1),
        limit: z.number().min(1).max(100).optional(),
        nextToken: z.string().optional(),
      })
    )
    .query(({ input }) => Event.listEventsByArtForm(input.artForm, input)),

  byTag: publicProcedure
    .input(
      z.object({
        tag: z.string().min(1),
        limit: z.number().min(1).max(200).optional(),
      })
    )
    .query(({ input }) => Event.listEventsByTag(input.tag, input)),

  checkPosterHash: editorProcedure
    .input(z.object({ hash: z.string().min(1) }))
    .query(async ({ input }) => {
      const record = await Event.getPosterByHash(input.hash);
      if (!record) return { duplicate: false } as const;

      // Only consider as duplicate if at least one linked event is approved
      const events = await Promise.all(record.eventIds.map(id => Event.getEvent(id)));
      const approvedIds = record.eventIds.filter((_, i) => events[i]?.status === 'approved');
      if (approvedIds.length === 0) return { duplicate: false } as const;

      return {
        duplicate: true,
        posterUrl: record.posterUrl,
        festivalId: record.festivalId,
        eventIds: approvedIds,
      } as const;
    }),

  matchEntities: editorProcedure
    .input(
      z.object({
        artistNames: z.array(z.string()).default([]),
        venueNames: z.array(z.string()).default([]),
        organiserNames: z.array(z.string()).default([]),
      })
    )
    .query(async ({ input }) => {
      type Suggestion = { id: string; name: string; score: number };

      async function resolveArtist(name: string): Promise<[string, Suggestion[]]> {
        const [exact, fuzzy] = await Promise.all([
          Artist.getArtistByName(name),
          Search.search(name, { filters: ['name'], limit: 3 }),
        ]);
        const suggestions: Suggestion[] = [];
        if (exact) suggestions.push({ id: exact.id, name: exact.name, score: 0 });
        for (const r of fuzzy.items.filter(item => item.type === 'artist')) {
          if (!suggestions.some(s => s.id === r.id)) {
            suggestions.push({ id: r.id, name: r.name, score: r.score });
          }
        }
        return [name.toLowerCase(), suggestions.slice(0, 3)];
      }

      async function resolveVenue(name: string): Promise<[string, Suggestion[]]> {
        const [exact, fuzzy] = await Promise.all([
          Venue.getVenueByName(name),
          Search.search(name, { filters: ['name'], limit: 3 }),
        ]);
        const suggestions: Suggestion[] = [];
        if (exact) suggestions.push({ id: exact.id, name: exact.name, score: 0 });
        for (const r of fuzzy.items.filter(item => item.type === 'venue')) {
          if (!suggestions.some(s => s.id === r.id)) {
            suggestions.push({ id: r.id, name: r.name, score: r.score });
          }
        }
        return [name.toLowerCase(), suggestions.slice(0, 3)];
      }

      async function resolveOrganiser(name: string): Promise<[string, Suggestion[]]> {
        const [exact, fuzzy] = await Promise.all([
          Organiser.getOrganiserByName(name),
          Search.search(name, { filters: ['name'], limit: 3 }),
        ]);
        const suggestions: Suggestion[] = [];
        if (exact) suggestions.push({ id: exact.id, name: exact.name, score: 0 });
        for (const r of fuzzy.items.filter(item => item.type === 'organiser')) {
          if (!suggestions.some(s => s.id === r.id)) {
            suggestions.push({ id: r.id, name: r.name, score: r.score });
          }
        }
        return [name.toLowerCase(), suggestions.slice(0, 3)];
      }

      const [artistEntries, venueEntries, organiserEntries] = await Promise.all([
        Promise.all(input.artistNames.map(resolveArtist)),
        Promise.all(input.venueNames.map(resolveVenue)),
        Promise.all(input.organiserNames.map(resolveOrganiser)),
      ]);

      return {
        artists: Object.fromEntries(artistEntries.filter(([, s]) => s.length > 0)),
        venues: Object.fromEntries(venueEntries.filter(([, s]) => s.length > 0)),
        organisers: Object.fromEntries(organiserEntries.filter(([, s]) => s.length > 0)),
      };
    }),

  // === MUTATIONS ===

  getUploadUrl: editorProcedure
    .input(z.object({ fileName: z.string(), contentType: z.string() }))
    .mutation(({ input }) => Event.getUploadUrl(input.fileName, input.contentType)),

  extractFromPoster: editorProcedure
    .input(
      z.object({
        posterUploadId: z.string(),
        posterUrl: z.string().url(),
        posterOgUrl: z.string().url().optional(),
        posterHash: z.string().optional(),
        existingFestivalId: z.string().optional(),
      })
    )
    .mutation(({ ctx, input }) => {
      return Event.extractAndCreateDrafts(
        input.posterUploadId,
        input.posterUrl,
        ctx.user.id,
        input.posterHash,
        input.existingFestivalId,
        undefined,
        undefined,
        input.posterOgUrl
      );
    }),

  extractFromInstagramUrl: editorProcedure
    .input(
      z.object({
        instagramUrl: z.string().url(),
        existingFestivalId: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const match = input.instagramUrl.match(/instagram\.com\/(?:p|reel)\/([A-Za-z0-9_-]+)/);
      if (!match) {
        throw new TRPCError({ code: 'BAD_REQUEST', message: 'Invalid Instagram post URL' });
      }
      const shortcode = match[1];

      // Invoke the dedicated Puppeteer Lambda — keeps Chromium out of the tRPC bundle.
      const fetcherName = process.env.INSTAGRAM_IMAGE_FETCHER_FUNCTION_NAME;
      if (!fetcherName) throw new Error('INSTAGRAM_IMAGE_FETCHER_FUNCTION_NAME is not set');
      const fetcherResult = await lambdaClient.send(
        new InvokeCommand({
          FunctionName: fetcherName,
          Payload: Buffer.from(JSON.stringify({ postUrl: input.instagramUrl })),
        })
      );
      type FetchResult =
        | { ok: true; imageBase64: string; contentType: string; altText?: string }
        | { ok: false; error: string };
      const fetched = JSON.parse(
        Buffer.from(fetcherResult.Payload ?? []).toString()
      ) as FetchResult;
      if (!fetched.ok) {
        throw new TRPCError({ code: 'BAD_REQUEST', message: fetched.error });
      }
      const { uploadId, posterUrl } = await Event.uploadPosterFromBuffer(
        Buffer.from(fetched.imageBase64, 'base64'),
        fetched.contentType
      );

      const result = await Event.extractAndCreateDrafts(
        uploadId,
        posterUrl,
        ctx.user.id,
        undefined,
        input.existingFestivalId,
        { platform: 'instagram', postId: shortcode, postUrl: input.instagramUrl },
        fetched.altText
      );
      return { ...result, posterUrl };
    }),

  submitVerified: editorProcedure
    .input(
      z.object({
        festivalId: z.string().optional(),
        festivalData: Festival.CreateFestivalSchema.optional(),
        events: z.array(
          Event.CreateEventSchema.extend({
            id: z.string().min(1),
          })
        ),
      })
    )
    .mutation(async ({ ctx, input }) => {
      // Update festival if provided
      if (input.festivalId && input.festivalData) {
        await Festival.updateFestival(input.festivalId, {
          ...input.festivalData,
        } as Festival.UpdateFestivalInput);
        await Festival.submitFestival(input.festivalId).catch(() => {});
      }

      // Auto-create venues/organisers/artists that don't have IDs
      const venueCache = new Map<string, string>();
      const organiserCache = new Map<string, string>();
      const artistCache = new Map<string, string>();

      const resolveVenue = async (name?: string, id?: string) => {
        if (id) {
          const venue = await Venue.getVenue(id);
          if (venue?.mergedIntoId) {
            const canonical = await Venue.getVenue(venue.mergedIntoId);
            if (canonical)
              return {
                venueId: canonical.id,
                venueName: canonical.name,
                venueCity: canonical.city,
              };
          }
          return { venueId: id, venueName: name, venueCity: venue?.city };
        }
        if (!name) return { venueId: undefined, venueName: undefined, venueCity: undefined };
        if (venueCache.has(name))
          return { venueId: venueCache.get(name), venueName: name, venueCity: undefined };
        const existing = await Venue.getVenueByName(name);
        if (existing) {
          venueCache.set(name, existing.id);
          return { venueId: existing.id, venueName: existing.name, venueCity: existing.city };
        }
        const created = await Venue.createVenue({ name });
        venueCache.set(name, created.id);
        return { venueId: created.id, venueName: name, venueCity: undefined };
      };

      const resolveOrganiser = async (name?: string, id?: string) => {
        if (id) {
          const organiser = await Organiser.getOrganiser(id);
          if (organiser?.mergedIntoId) {
            const canonical = await Organiser.getOrganiser(organiser.mergedIntoId);
            if (canonical) return { organiserId: canonical.id, organiserName: canonical.name };
          }
          return { organiserId: id, organiserName: name };
        }
        if (!name) return { organiserId: undefined, organiserName: undefined };
        if (organiserCache.has(name))
          return { organiserId: organiserCache.get(name), organiserName: name };
        const existing = await Organiser.getOrganiserByName(name);
        if (existing) {
          organiserCache.set(name, existing.id);
          return { organiserId: existing.id, organiserName: existing.name };
        }
        const created = await Organiser.createOrganiser({ name });
        organiserCache.set(name, created.id);
        return { organiserId: created.id, organiserName: name };
      };

      // Fetched once for the whole batch. Dedup matching needs every artist as
      // candidates, and resolveArtist runs inside a sequential loop over events,
      // so leaving the fetch inside would sweep the artist list once per new
      // name rather than once per import.
      let artistCandidates: Artist.Artist[] | undefined;

      const resolveArtist = async (artist: { id?: string; name: string; title?: string }) => {
        if (artist.id) {
          const a = await Artist.getArtist(artist.id);
          if (a?.mergedIntoId) return a.mergedIntoId;
          return artist.id;
        }
        // Key on the normalized form so "Sri T M Krishna" and "T M Krishna"
        // share a cache entry instead of each resolving separately.
        const key = Artist.normalizeArtistName(artist.name);
        const cached = artistCache.get(key);
        if (cached) return cached;
        artistCandidates ??= await Artist.listAllArtistsForMatching();
        const { artist: resolved, created } = await Artist.findOrCreateArtist(artist.name, {
          title: artist.title,
          candidates: artistCandidates,
        });
        if (created) artistCandidates.push(resolved);
        artistCache.set(key, resolved.id);
        return resolved.id;
      };

      const isModerator =
        ctx.user.role === Auth.ROLE.MODERATOR || ctx.user.role === Auth.ROLE.ADMIN;

      // Update each draft event with verified data and submit for review.
      // Outer loop is sequential to keep venueCache/organiserCache/artistCache consistent.
      const results = [];
      for (const eventInput of input.events) {
        const { id, ...eventData } = eventInput;

        // Venue and organiser are independent — resolve in parallel
        const [venue, organiser] = await Promise.all([
          resolveVenue(eventData.venueName ?? undefined, eventData.venueId ?? undefined),
          resolveOrganiser(
            eventData.organiserName ?? undefined,
            eventData.organiserId ?? undefined
          ),
        ]);

        // Resolve artist IDs in parallel with deduplication guard to prevent cache races
        const seen = new Map<string, Promise<string | undefined>>();
        const resolvedArtists = await Promise.all(
          (eventData.artists || []).map(artist => {
            const normalised = {
              ...artist,
              id: artist.id ?? undefined,
              title: artist.title ?? undefined,
            };
            const key = normalised.id ?? Artist.normalizeArtistName(artist.name);
            if (!seen.has(key)) seen.set(key, resolveArtist(normalised));
            return seen.get(key)!.then(artistId => ({ ...artist, id: artistId }));
          })
        );

        await Event.submitEvent(
          id,
          {
            ...eventData,
            festivalId: input.festivalId,
            ...venue,
            ...organiser,
            artists: resolvedArtists,
          },
          ctx.user.id
        );

        // Moderators and admins can publish directly without a separate review step
        const event = isModerator
          ? await Event.approveEvent(id, ctx.user.id)
          : await Event.getEvent(id);
        results.push(event);
      }
      triggerReindex();
      return results;
    }),

  // === MODERATOR PROCEDURES ===

  approveEvent: moderatorProcedure
    .input(z.object({ eventId: z.string().min(1) }))
    .mutation(async ({ ctx, input }) => {
      const result = await Event.approveEvent(input.eventId, ctx.user.id);
      triggerReindex();
      return result;
    }),

  rejectEvent: moderatorProcedure
    .input(
      z.object({
        eventId: z.string().min(1),
        moderatorNote: z.string().min(1),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const result = await Event.rejectEvent(input.eventId, ctx.user.id, input.moderatorNote);
      triggerReindex();
      return result;
    }),

  listSubmittedEvents: moderatorProcedure
    .input(
      z
        .object({
          limit: z.number().min(1).max(100).optional(),
          nextToken: z.string().optional(),
        })
        .optional()
    )
    .query(({ input }) => Event.listSubmittedEvents(input)),

  getForReview: moderatorProcedure
    .input(z.object({ id: z.string().min(1) }))
    .query(async ({ input }) => {
      const event = await Event.getEvent(input.id);
      if (!event) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Event not found',
          cause: new ApplicationError(ErrorCode.EVENT_NOT_FOUND, 'Event not found'),
        });
      }
      return event;
    }),

  getMergeSuggestion: moderatorProcedure
    .input(z.object({ idA: z.string().min(1), idB: z.string().min(1) }))
    .query(async ({ input }) => {
      const [entityA, entityB, scoreA, scoreB] = await Promise.all([
        Event.getEvent(input.idA),
        Event.getEvent(input.idB),
        Event.getEventMergeScore(input.idA),
        Event.getEventMergeScore(input.idB),
      ]);
      return {
        entityA: entityA ? { id: entityA.id, name: entityA.title, score: scoreA } : null,
        entityB: entityB ? { id: entityB.id, name: entityB.title, score: scoreB } : null,
        suggestedCanonicalId: scoreA >= scoreB ? input.idA : input.idB,
      };
    }),

  listDraftEvents: moderatorProcedure
    .input(
      z
        .object({
          limit: z.number().min(1).max(100).optional(),
          nextToken: z.string().optional(),
        })
        .optional()
    )
    .query(({ input }) => Event.listDraftEvents(input)),

  forceSubmitDraft: moderatorProcedure
    .input(z.object({ eventId: z.string().min(1) }))
    .mutation(async ({ input }) => {
      const result = await Event.forceSubmitEvent(input.eventId);
      triggerReindex();
      return result;
    }),

  deleteDraftEvent: moderatorProcedure
    .input(z.object({ eventId: z.string().min(1) }))
    .mutation(async ({ input }) => {
      const result = await Event.softDeleteEvent(input.eventId);
      triggerReindex();
      return result;
    }),

  reExtractDraft: moderatorProcedure
    .input(z.object({ eventId: z.string().min(1) }))
    .mutation(async ({ input }) => {
      const existing = await Event.getEvent(input.eventId);
      if (!existing || existing.status !== 'draft') {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Draft event not found',
          cause: new ApplicationError(ErrorCode.EVENT_NOT_FOUND, 'Draft event not found'),
        });
      }
      if (!existing.posterUrl) {
        throw new TRPCError({ code: 'BAD_REQUEST', message: 'No poster URL on this draft' });
      }

      await Event.softDeleteEvent(input.eventId);

      const { eventIds } = await Event.extractAndCreateDrafts(
        existing.posterUploadId ?? existing.id,
        existing.posterUrl,
        existing.createdBy
      );
      return { eventIds };
    }),

  updatePoster: moderatorProcedure
    .input(
      z.object({
        id: z.string().min(1),
        posterUrl: z.string().url(),
        posterOgUrl: z.string().url().optional(),
        posterUploadId: z.string(),
      })
    )
    .mutation(async ({ input }) => {
      const result = await Event.updateApprovedEvent(input.id, {
        posterUrl: input.posterUrl,
        posterOgUrl: input.posterOgUrl,
        posterUploadId: input.posterUploadId,
      });
      triggerReindex();
      return result;
    }),
});
