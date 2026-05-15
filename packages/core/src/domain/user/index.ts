import { ApplicationError, ErrorCode } from '@rasika/core';
import type { z } from 'zod';
import { ROLE } from '../../auth/roles';
import { generateId } from '../../utils';
import { UserEntity } from './entity';
import type { User } from './entity';
import type { CreateUserSchema, UpdateUserSchema } from './schema';

export type CreateUserInput = z.infer<typeof CreateUserSchema>;
export type UpdateUserInput = z.infer<typeof UpdateUserSchema>;

export async function createUser(input: CreateUserInput): Promise<User> {
  const result = await UserEntity.create(input).go();

  if (!result.data) {
    throw new ApplicationError(
      ErrorCode.USER_CREATE_FAILED,
      `Failed to create user: ${input.email}`
    );
  }

  return result.data as User;
}

export async function getUser(id: string): Promise<User | null> {
  const result = await UserEntity.get({ id }).go();

  if (!result.data) {
    return null;
  }

  return result.data as User;
}

export async function getUserByEmail(email: string): Promise<User | null> {
  const result = await UserEntity.query.byEmail({ email }).go();
  return result.data?.[0] || null;
}

export async function getUserByGoogleId(googleId: string): Promise<User | null> {
  const result = await UserEntity.query.byGoogleId({ googleId }).go();
  return result.data?.[0] || null;
}

export async function updateUser(id: string, input: UpdateUserInput): Promise<User> {
  const result = await UserEntity.update({ id }).set(input).go({ response: 'all_new' });

  if (!result.data) {
    throw new ApplicationError(ErrorCode.USER_NOT_FOUND, `User with ID ${id} not found`);
  }

  return result.data as User;
}

export async function updateLastSignedIn(id: string): Promise<User> {
  const result = await UserEntity.update({ id })
    .set({ lastSignedInAt: new Date().toISOString() })
    .go({ response: 'all_new' });

  if (!result.data) {
    throw new ApplicationError(ErrorCode.USER_NOT_FOUND, `User with ID ${id} not found`);
  }

  return result.data as User;
}

export async function updateUserRole(
  id: string,
  role: (typeof ROLE)[keyof typeof ROLE]
): Promise<User> {
  const result = await UserEntity.update({ id }).set({ role }).go({ response: 'all_new' });

  if (!result.data) {
    throw new ApplicationError(ErrorCode.USER_NOT_FOUND, `User with ID ${id} not found`);
  }

  return result.data as User;
}

export async function findOrCreateUser(profile: {
  email: string;
  name: string;
  picture?: string;
  googleId: string;
}): Promise<User> {
  const userByGoogleId = await getUserByGoogleId(profile.googleId);
  if (userByGoogleId) {
    return updateLastSignedIn(userByGoogleId.id);
  }

  const userByEmail = await getUserByEmail(profile.email);
  if (userByEmail) {
    return updateUser(userByEmail.id, {
      googleId: profile.googleId,
    });
  }

  const id = generateId();
  return createUser({
    id,
    role: ROLE.EDITOR,
    ...profile,
  });
}

export async function listAllUsers(): Promise<User[]> {
  const result = await UserEntity.scan.go({ pages: 'all' });
  return result.data as User[];
}

export type UserPreferences = {
  theme?: 'system' | 'light' | 'dark';
  contentLanguage?:
    | 'english'
    | 'tamil'
    | 'telugu'
    | 'kannada'
    | 'hindi'
    | 'devanagari'
    | 'sanskrit';
  contributeToPublicSetlists?: boolean;
  attendanceVisible?: boolean;
  showProfilePublicly?: boolean;
  displayName?: string;
  bio?: string;
};

const PREFERENCE_DEFAULTS: Required<UserPreferences> = {
  theme: 'system',
  contentLanguage: 'english',
  contributeToPublicSetlists: true,
  attendanceVisible: false,
  showProfilePublicly: true,
  displayName: '',
  bio: '',
};

export function getEffectivePreferences(user: User): Required<UserPreferences> {
  const prefs = user.preferences as Partial<UserPreferences> | undefined;
  return {
    ...PREFERENCE_DEFAULTS,
    ...prefs,
    displayName: prefs?.displayName || user.name,
  } as Required<UserPreferences>;
}

async function toUniqueUsernameSlug(
  displayName: string,
  currentUserId: string
): Promise<string | undefined> {
  const base = displayName
    .toLowerCase()
    .trim()
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9-]/g, '');
  if (!base) return undefined;

  const existing = await getUserByUsername(base);
  if (!existing || existing.id === currentUserId) return base;

  for (let i = 2; i <= 99; i++) {
    const candidate = `${base}-${i}`;
    const taken = await getUserByUsername(candidate);
    if (!taken || taken.id === currentUserId) return candidate;
  }

  return `${base}-${currentUserId.slice(-6)}`;
}

export async function updateUserPreferences(
  id: string,
  preferences: Partial<UserPreferences>
): Promise<Required<UserPreferences>> {
  const user = await getUser(id);
  if (!user) {
    throw new ApplicationError(ErrorCode.USER_NOT_FOUND, `User with ID ${id} not found`);
  }

  const merged = { ...(user.preferences ?? {}), ...preferences };

  const setPayload: Record<string, unknown> = { preferences: merged };
  if (preferences.displayName !== undefined) {
    const slug = await toUniqueUsernameSlug(preferences.displayName || user.name, id);
    if (slug) setPayload.username = slug;
  }

  const updated = await UserEntity.update({ id })
    .set(setPayload as Parameters<ReturnType<typeof UserEntity.update>['set']>[0])
    .go({ response: 'all_new' });
  return getEffectivePreferences(updated.data as User);
}

export async function getUserByUsername(username: string): Promise<User | null> {
  const result = await UserEntity.query.byUsername({ username: username.toLowerCase() }).go();
  return (result.data?.[0] as User) ?? null;
}

export type { User } from './entity';
export { CreateUserSchema, UpdateUserSchema, UpdateUserRoleSchema } from './schema';
