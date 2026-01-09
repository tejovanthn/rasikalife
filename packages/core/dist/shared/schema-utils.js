import { z } from 'zod';
// Since our entities are now simple (just name field), we'll keep schemas simple
// In the future, this could be expanded to auto-generate from entity definitions
// For now, all our entities follow the same pattern: just a required name field
export const createNameOnlySchema = z.object({
    name: z.string().min(1).max(100),
});
export const updateNameOnlySchema = createNameOnlySchema.partial();
