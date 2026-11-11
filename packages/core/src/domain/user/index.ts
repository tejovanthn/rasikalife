import type { z } from 'zod';
import { ROLE } from '../../auth/roles';
import { ApplicationError, ErrorCode } from '../../constants';
import { generateId } from '../../utils';
import { CONSENT_VERSIONS } from '../venue-qr/constants';
import { UserEntity } from './entity';
import type { User } from './entity';
import { resolveHomeLocation } from './home-location';
import type { HomeLocation, HomeLocationInput, HomeLocationResult } from './home-location';
import type { CreateUserSchema, NotifyPrefsInput, UpdateUserSchema } from './schema';
import { SetWhatsappSchema } from './schema';
import { newUnsubscribeToken } from './unsubscribe-token';

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

export async function getHomeLocation(id: string): Promise<HomeLocation | null> {
  const user = await getUser(id);
  return (user?.homeLocation as HomeLocation | undefined) ?? null;
}

/**
 * Saves where the reader's distances are measured from. A refused input (bad or unknown PIN)
 * writes nothing and says why, so the form can.
 */
export async function setHomeLocation(
  id: string,
  input: HomeLocationInput
): Promise<HomeLocationResult> {
  const result = resolveHomeLocation(input);
  if (!result.ok) return result;
  await UserEntity.update({ id }).set({ homeLocation: result.location }).go();
  return result;
}

/** `.remove`, not `.set(undefined)`: ElectroDB drops an undefined value (CLAUDE.md rule 8). */
export async function clearHomeLocation(id: string): Promise<void> {
  await UserEntity.update({ id }).remove(['homeLocation']).go();
}

export async function getUserByUsername(username: string): Promise<User | null> {
  const result = await UserEntity.query.byUsername({ username: username.toLowerCase() }).go();
  return (result.data?.[0] as User) ?? null;
}

export type NotifyPrefs = {
  notifyDigest: boolean;
  notifyReminder: boolean;
  notifyEmail: boolean;
  notifyPush: boolean;
};

export const NOTIFY_DEFAULTS: NotifyPrefs = {
  notifyDigest: true,
  notifyReminder: true,
  notifyEmail: true,
  notifyPush: false,
};

/**
 * Notification preferences with defaults for rows written before the fields existed.
 * ElectroDB applies `default` only on create, so an older row reads back with none of them.
 */
export function effectiveNotifyPrefs(
  user: Partial<Record<keyof NotifyPrefs, boolean | undefined>>
): NotifyPrefs {
  return {
    notifyDigest: user.notifyDigest ?? NOTIFY_DEFAULTS.notifyDigest,
    notifyReminder: user.notifyReminder ?? NOTIFY_DEFAULTS.notifyReminder,
    notifyEmail: user.notifyEmail ?? NOTIFY_DEFAULTS.notifyEmail,
    notifyPush: user.notifyPush ?? NOTIFY_DEFAULTS.notifyPush,
  };
}

export async function getNotifyPrefs(id: string): Promise<NotifyPrefs> {
  const user = await getUser(id);
  if (!user) {
    throw new ApplicationError(ErrorCode.USER_NOT_FOUND, `User with ID ${id} not found`);
  }
  return effectiveNotifyPrefs(user);
}

export async function setNotifyPrefs(id: string, input: NotifyPrefsInput): Promise<NotifyPrefs> {
  const changes: Partial<NotifyPrefs> = {};
  for (const key of Object.keys(NOTIFY_DEFAULTS) as Array<keyof NotifyPrefs>) {
    if (input[key] !== undefined) changes[key] = input[key];
  }
  if (Object.keys(changes).length === 0) return getNotifyPrefs(id);
  const result = await UserEntity.patch({ id }).set(changes).go({ response: 'all_new' });
  return effectiveNotifyPrefs(result.data as User);
}

/**
 * The user's unsubscribe token. Rows from before the field existed get one on first use; the
 * write is conditional so two callers cannot leave two different tokens in circulation.
 */
export async function getOrCreateUnsubscribeToken(id: string): Promise<string> {
  const user = await getUser(id);
  if (!user) {
    throw new ApplicationError(ErrorCode.USER_NOT_FOUND, `User with ID ${id} not found`);
  }
  if (user.unsubscribeToken) return user.unsubscribeToken;
  try {
    const result = await UserEntity.patch({ id })
      .set({ unsubscribeToken: newUnsubscribeToken() })
      .where((attr, op) => op.notExists(attr.unsubscribeToken))
      .go({ response: 'all_new' });
    return (result.data as User).unsubscribeToken as string;
  } catch {
    const again = await getUser(id);
    if (again?.unsubscribeToken) return again.unsubscribeToken;
    throw new ApplicationError(ErrorCode.DATABASE_ERROR, 'Could not create an unsubscribe token');
  }
}

/** Replaces the token. Call after a token is used, so an old link stops working. */
export async function rotateUnsubscribeToken(id: string): Promise<string> {
  const token = newUnsubscribeToken();
  await UserEntity.patch({ id }).set({ unsubscribeToken: token }).go();
  return token;
}

export async function setDigestLastSentAt(id: string, at: Date = new Date()): Promise<void> {
  await UserEntity.patch({ id }).set({ digestLastSentAt: at.toISOString() }).go();
}

/** Records the target day (`YYYY-MM-DD`, IST) of the reminder just sent. */
export async function setReminderLastSentOn(id: string, day: string): Promise<void> {
  await UserEntity.patch({ id }).set({ reminderLastSentOn: day }).go();
}

/**
 * Stores a WhatsApp number with consent. A bad number is `WHATSAPP_INVALID_NUMBER`. Changing the
 * number clears `whatsappVerifiedAt` (rule 8: `.remove`), since the new number is not verified.
 * Nothing is sent to it in v1.
 */
export async function setWhatsapp(
  id: string,
  input: { number: string; consent: boolean },
  now: Date = new Date()
): Promise<User> {
  const parsed = SetWhatsappSchema.safeParse(input);
  if (!parsed.success) {
    const message = parsed.error.issues.some(i => i.path[0] === 'number')
      ? 'WhatsApp number must be 10 digits starting 6 to 9'
      : 'Consent is required to store a WhatsApp number';
    throw new ApplicationError(ErrorCode.WHATSAPP_INVALID_NUMBER, message);
  }
  const result = await UserEntity.patch({ id })
    .set({
      whatsappNumber: parsed.data.number,
      whatsappConsentAt: now.toISOString(),
      whatsappConsentVersion: CONSENT_VERSIONS.whatsapp,
    })
    .remove(['whatsappVerifiedAt'])
    .go({ response: 'all_new' });
  return result.data as User;
}

export async function removeWhatsapp(id: string): Promise<void> {
  await UserEntity.patch({ id })
    .remove(['whatsappNumber', 'whatsappConsentAt', 'whatsappConsentVersion', 'whatsappVerifiedAt'])
    .go();
}

export async function dismissWhatsappPrompt(id: string, now: Date = new Date()): Promise<void> {
  await UserEntity.patch({ id }).set({ whatsappPromptDismissedAt: now.toISOString() }).go();
}

export type { User } from './entity';
export {
  CreateUserSchema,
  NotifyPrefsSchema,
  SetWhatsappSchema,
  UpdateUserSchema,
  UpdateUserRoleSchema,
} from './schema';
export type { NotifyPrefsInput } from './schema';
export { homeLocationLabel, resolveHomeLocation } from './home-location';
export type { HomeLocation, HomeLocationInput, HomeLocationResult } from './home-location';
