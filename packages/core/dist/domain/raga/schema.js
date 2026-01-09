import { createNameOnlySchema } from '../../shared/schema-utils';
// Input schema for API operations - simple like artist
export const CreateRagaSchema = createNameOnlySchema;
export const UpdateRagaSchema = CreateRagaSchema.partial();
