/** Roles that may use this app. Mirrors `moderatorProcedure` in `packages/trpc/src/trpc.ts`. */
const MODERATOR_ROLES = ['moderator', 'admin'];

export function isModeratorRole(role: string | null | undefined): boolean {
  return Boolean(role) && MODERATOR_ROLES.includes(role as string);
}
