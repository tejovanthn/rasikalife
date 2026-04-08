import { InvokeCommand, LambdaClient } from '@aws-sdk/client-lambda';
import { Artist, Organiser, SocialPost, Venue } from '@rasika/core';
import { TRPCError } from '@trpc/server';
import { z } from 'zod';
import { createTRPCRouter, moderatorProcedure } from '../trpc';

const PROCESSING_STATUSES = ['pending', 'processed', 'skipped', 'failed'] as const;
const STATS_LIMIT = 500;

const lambdaClient = new LambdaClient({});

function extractInstagramHandle(url: string): string | null {
  const match = url.match(/instagram\.com\/([A-Za-z0-9_.]+)\/?/);
  return match ? match[1] : null;
}

export const crawlRouter = createTRPCRouter({
  getStats: moderatorProcedure.query(async () => {
    const results = await Promise.all(
      PROCESSING_STATUSES.map(status =>
        SocialPost.listPostsByStatus(status, { limit: STATS_LIMIT })
      )
    );

    return Object.fromEntries(
      PROCESSING_STATUSES.map((status, i) => [
        status,
        { count: results[i].items.length, hasMore: results[i].hasMore },
      ])
    ) as Record<(typeof PROCESSING_STATUSES)[number], { count: number; hasMore: boolean }>;
  }),

  listPosts: moderatorProcedure
    .input(
      z.object({
        status: z.enum(PROCESSING_STATUSES).default('failed'),
        limit: z.number().min(1).max(100).optional(),
        nextToken: z.string().optional(),
      })
    )
    .query(({ input }) =>
      SocialPost.listPostsByStatus(input.status, {
        limit: input.limit ?? 50,
        nextToken: input.nextToken,
      })
    ),

  triggerCrawl: moderatorProcedure
    .input(
      z.object({
        entityId: z.string().min(1),
        entityType: z.enum(['artist', 'organiser', 'venue']),
      })
    )
    .mutation(async ({ input }) => {
      const entity = await (input.entityType === 'artist'
        ? Artist.getArtist(input.entityId)
        : input.entityType === 'organiser'
          ? Organiser.getOrganiser(input.entityId)
          : Venue.getVenue(input.entityId));

      if (!entity) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Entity not found' });
      }

      const instagramLink = (entity.socialLinks ?? []).find(l => l.platform === 'instagram');
      if (!instagramLink) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'No Instagram link found for this entity',
        });
      }

      const handle = extractInstagramHandle(instagramLink.url);
      if (!handle) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'Could not extract Instagram handle from URL',
        });
      }

      const functionName = process.env.INSTAGRAM_SCRAPER_FUNCTION_NAME;
      if (!functionName) {
        throw new Error('INSTAGRAM_SCRAPER_FUNCTION_NAME not set');
      }

      await lambdaClient.send(
        new InvokeCommand({
          FunctionName: functionName,
          InvocationType: 'Event',
          Payload: Buffer.from(
            JSON.stringify({
              Records: [
                {
                  body: JSON.stringify({
                    handle,
                    entityId: input.entityId,
                    entityType: input.entityType,
                  }),
                },
              ],
            })
          ),
        })
      );

      return { triggered: true, handle };
    }),
});
