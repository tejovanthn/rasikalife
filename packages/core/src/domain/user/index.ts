import { ApplicationError, ErrorCode } from '@rasika/core';
import type { z } from 'zod';
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
  const result = await UserEntity.update({ id }).set(input).go();

  if (!result.data) {
    throw new ApplicationError(ErrorCode.USER_NOT_FOUND, `User with ID ${id} not found`);
  }

  return result.data as User;
}

export async function updateLastSignedIn(id: string): Promise<User> {
  const result = await UserEntity.update({ id })
    .set({ lastSignedInAt: new Date().toISOString() })
    .go();

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
  // First try to find by Google ID (existing user with this Google account)
  const userByGoogleId = await getUserByGoogleId(profile.googleId);
  if (userByGoogleId) {
    return updateLastSignedIn(userByGoogleId.id);
  }

  // Then try to find by email (existing user, link Google account)
  const userByEmail = await getUserByEmail(profile.email);
  if (userByEmail) {
    // Update Google ID to link accounts and update last signed in
    return updateUser(userByEmail.id, {
      googleId: profile.googleId,
    });
  }

  // Create new user with our own KSUID
  const id = generateId();
  return createUser({
    id,
    ...profile,
  });
}

export type { User } from './entity';
export { CreateUserSchema, UpdateUserSchema } from './schema';
