import { z } from 'zod';
import { ContentCategory, ContentStatus, ContentVisibility } from '../../types';

// Input schemas for API operations
export const CreateContentSchema = z.object({
  path: z.string().min(1),
  content: z.string().min(1),
  category: z.nativeEnum(ContentCategory),
  status: z.nativeEnum(ContentStatus).optional().default(ContentStatus.DRAFT),
  visibility: z.nativeEnum(ContentVisibility).optional().default(ContentVisibility.PRIVATE),
  editorId: z.string().min(1),
  meta: z.object({
    title: z.string().min(1),
    description: z.string().min(1),
    keywords: z.array(z.string()),
    robots: z.string().optional(),
  }),
  navigation: z
    .object({
      breadcrumbs: z.array(
        z.object({
          label: z.string(),
          path: z.string(),
        })
      ),
      menuPlacement: z
        .object({
          section: z.string(),
          order: z.number(),
        })
        .optional(),
      relatedPages: z.array(
        z.object({
          title: z.string(),
          path: z.string(),
          description: z.string().optional(),
        })
      ),
    })
    .optional(),
});

export const UpdateContentSchema = z.object({
  path: z.string().min(1).optional(),
  content: z.string().min(1).optional(),
  category: z.nativeEnum(ContentCategory).optional(),
  status: z.nativeEnum(ContentStatus).optional(),
  visibility: z.nativeEnum(ContentVisibility).optional(),
  editorId: z.string().min(1).optional(),
  meta: z
    .object({
      title: z.string().min(1).optional(),
      description: z.string().min(1).optional(),
      keywords: z.array(z.string()).optional(),
      robots: z.string().optional(),
    })
    .optional(),
  navigation: z
    .object({
      breadcrumbs: z
        .array(
          z.object({
            label: z.string().optional(),
            path: z.string().optional(),
          })
        )
        .optional(),
      menuPlacement: z
        .object({
          section: z.string().optional(),
          order: z.number().optional(),
        })
        .optional(),
      relatedPages: z
        .array(
          z.object({
            title: z.string().optional(),
            path: z.string().optional(),
            description: z.string().optional(),
          })
        )
        .optional(),
    })
    .optional(),
});
