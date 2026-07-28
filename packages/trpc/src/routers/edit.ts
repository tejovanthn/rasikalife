import {
  type EditEntityType,
  EditStatus,
  approveEdit,
  createDraft,
  getActiveEditForEntity,
  getEditById,
  getEntityEdits,
  getPendingEdits,
  getUserEdits,
  rejectEdit,
  requestDeletion,
  requestMerge,
  submitEdit,
  updateDraft,
  withdrawEdit,
} from '@rasika/core';
import { ArtistClaim, EditEntityTypes } from '@rasika/core';
import { TRPCError } from '@trpc/server';
import { z } from 'zod';
import { createTRPCRouter, moderatorProcedure, protectedProcedure } from '../trpc';

const editEntityTypeSchema = z.enum([
  EditEntityTypes.COMPOSITION,
  EditEntityTypes.ARTIST,
  EditEntityTypes.RAGA,
  EditEntityTypes.TALA,
  EditEntityTypes.EVENT,
  EditEntityTypes.VENUE,
  EditEntityTypes.ORGANISER,
  EditEntityTypes.FESTIVAL,
]);

const editStatusSchema = z.enum([
  EditStatus.DRAFT,
  EditStatus.SUBMITTED,
  EditStatus.APPROVED,
  EditStatus.REJECTED,
  EditStatus.WITHDRAWN,
]);

export const editRouter = createTRPCRouter({
  createDraft: protectedProcedure
    .input(
      z.object({
        entityType: editEntityTypeSchema,
        entityId: z.string().min(1),
        proposedValues: z.record(z.unknown()),
        userNote: z.string().optional(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const existingEdit = await getActiveEditForEntity(
        ctx.user.id,
        input.entityType,
        input.entityId
      );

      if (existingEdit) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: `You already have an active ${existingEdit.status} edit for this entity`,
        });
      }

      return createDraft({
        entityType: input.entityType,
        entityId: input.entityId,
        userId: ctx.user.id,
        proposedValues: input.proposedValues,
        userNote: input.userNote,
      });
    }),

  updateDraft: protectedProcedure
    .input(
      z.object({
        editId: z.string().min(1),
        proposedValues: z.record(z.unknown()).optional(),
        userNote: z.string().optional(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      return updateDraft(input.editId, ctx.user.id, {
        proposedValues: input.proposedValues,
        userNote: input.userNote,
      });
    }),

  submit: protectedProcedure
    .input(z.object({ editId: z.string().min(1) }))
    .mutation(async ({ input, ctx }) => {
      const submitted = await submitEdit(input.editId, ctx.user.id);

      // A verified claimant editing their own artist profile does not queue behind a
      // moderator (plan §4.3.1). This is what the claim actually buys: without it an approved
      // claim confers nothing, because submitting a draft is already open to every signed-in
      // user, so the queue would grant a badge and no capability.
      //
      // Deliberately narrow. It applies to the artist the claim names and nothing else, the
      // claim must be `verified` (an invite or a pending claim is not enough), and the edit
      // still travels the ordinary Edit pipeline — same schema, same validation, same audit
      // row — so this widens who may approve, not what may be written. The check is here
      // rather than in the web action because the client must not be able to assert it.
      const edit = await getEditById(input.editId);
      if (edit?.entityType === 'artist' && edit.entityId) {
        const owns = await ArtistClaim.canManageArtist(ctx.user.id, edit.entityId);
        if (owns) return approveEdit(input.editId, ctx.user.id);
      }

      return submitted;
    }),

  withdraw: protectedProcedure
    .input(z.object({ editId: z.string().min(1) }))
    .mutation(async ({ input, ctx }) => {
      return withdrawEdit(input.editId, ctx.user.id);
    }),

  approve: moderatorProcedure
    .input(z.object({ editId: z.string().min(1) }))
    .mutation(async ({ input, ctx }) => {
      return approveEdit(input.editId, ctx.user.id);
    }),

  reject: moderatorProcedure
    .input(
      z.object({
        editId: z.string().min(1),
        moderatorNote: z.string().min(1),
      })
    )
    .mutation(async ({ input, ctx }) => {
      return rejectEdit(input.editId, ctx.user.id, input.moderatorNote);
    }),

  getById: protectedProcedure
    .input(z.object({ editId: z.string().min(1) }))
    .query(async ({ input }) => {
      return getEditById(input.editId);
    }),

  getUserEdits: protectedProcedure
    .input(
      z
        .object({
          status: editStatusSchema.optional(),
          limit: z.number().min(1).max(100).optional(),
          nextToken: z.string().optional(),
        })
        .optional()
    )
    .query(async ({ input, ctx }) => {
      return getUserEdits(ctx.user.id, input);
    }),

  getEntityEdits: protectedProcedure
    .input(
      z.object({
        entityType: editEntityTypeSchema,
        entityId: z.string().min(1),
        status: editStatusSchema.optional(),
        limit: z.number().min(1).max(100).optional(),
        nextToken: z.string().optional(),
      })
    )
    .query(async ({ input }) => {
      return getEntityEdits(input.entityType, input.entityId, {
        status: input.status,
        limit: input.limit,
        nextToken: input.nextToken,
      });
    }),

  getPendingEdits: moderatorProcedure
    .input(
      z
        .object({
          entityType: editEntityTypeSchema.optional(),
          limit: z.number().min(1).max(100).optional(),
          nextToken: z.string().optional(),
        })
        .optional()
    )
    .query(async ({ input }) => {
      return getPendingEdits(input);
    }),

  getActiveEditForEntity: protectedProcedure
    .input(
      z.object({
        entityType: editEntityTypeSchema,
        entityId: z.string().min(1),
      })
    )
    .query(async ({ input, ctx }) => {
      return getActiveEditForEntity(ctx.user.id, input.entityType, input.entityId);
    }),

  requestDeletion: moderatorProcedure
    .input(
      z.object({
        entityType: editEntityTypeSchema,
        entityId: z.string().min(1),
        userNote: z.string().optional(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      return requestDeletion(
        input.entityType as EditEntityType,
        input.entityId,
        ctx.user.id,
        input.userNote
      );
    }),

  requestMerge: moderatorProcedure
    .input(
      z.object({
        entityType: editEntityTypeSchema,
        entityId: z.string().min(1),
        mergeTargetId: z.string().min(1),
        userNote: z.string().optional(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      return requestMerge(
        input.entityType as EditEntityType,
        input.entityId,
        input.mergeTargetId,
        ctx.user.id,
        input.userNote
      );
    }),

  saveChanges: protectedProcedure
    .input(
      z.object({
        entityType: editEntityTypeSchema,
        entityId: z.string().min(1),
        proposedValues: z.record(z.unknown()),
        userNote: z.string().optional(),
        editId: z.string().optional().nullable(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      if (input.editId) {
        return updateDraft(input.editId, ctx.user.id, {
          proposedValues: input.proposedValues,
          userNote: input.userNote,
        });
      }

      const existingEdit = await getActiveEditForEntity(
        ctx.user.id,
        input.entityType,
        input.entityId
      );

      if (existingEdit) {
        return updateDraft(existingEdit.id, ctx.user.id, {
          proposedValues: input.proposedValues,
          userNote: input.userNote,
        });
      }

      return createDraft({
        entityType: input.entityType,
        entityId: input.entityId,
        userId: ctx.user.id,
        proposedValues: input.proposedValues,
        userNote: input.userNote,
      });
    }),
});
