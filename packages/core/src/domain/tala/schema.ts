import { z } from 'zod';

import { TraditionSchema } from '../shared/schemas';

const CarnaticAngaStructureSchema = z.object({
  jati: z.enum(['tisra', 'chatusra', 'khanda', 'misra', 'sankeerna']),
  angas: z.array(z.object({ type: z.enum(['laghu', 'drutam', 'anudrutam']) })),
});

const HindustaniAngaStructureSchema = z.object({
  vibhags: z.array(
    z.object({
      matras: z.number().int().min(1),
      isKhali: z.boolean().optional(),
      label: z.string().max(50).optional(),
    })
  ),
});

export const CreateTalaSchema = z.object({
  name: z.string().min(1).max(100),
  description: z.string().max(5000).optional(),
  tradition: TraditionSchema.optional(),
  aksharas: z.number().int().min(1).optional(),
  angaStructure: z.union([CarnaticAngaStructureSchema, HindustaniAngaStructureSchema]).optional(),
});

export const UpdateTalaSchema = CreateTalaSchema.partial();
