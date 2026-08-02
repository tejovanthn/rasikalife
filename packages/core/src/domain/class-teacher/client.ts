/**
 * Browser-safe exports. Never import the domain's `index.ts` from a route file — it pulls in
 * ElectroDB and the AWS SDK, which use Node-only APIs.
 */
export { AddClassTeacherSchema, TEACHER_ROLES } from './schema';
export type { AddClassTeacherInput, TeacherRole } from './schema';
