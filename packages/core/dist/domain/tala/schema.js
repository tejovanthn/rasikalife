import { createNameOnlySchema } from '../../shared/schema-utils';
// Input schema for API operations - simple like artist
export const CreateTalaSchema = createNameOnlySchema;
export const UpdateTalaSchema = CreateTalaSchema.partial();
