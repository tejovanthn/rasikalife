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
  const { dynamoClient } = await import('../../db/client');
  const { DynamoDBDocumentClient, ScanCommand } = await import('@aws-sdk/lib-dynamodb');
  const { DynamoDBClient } = await import('@aws-sdk/client-dynamodb');
  const client = DynamoDBDocumentClient.from(new DynamoDBClient());
  const tableName = process.env.DYNAMODB_TABLE || 'RasikaLifeTable';

  const result = await client.send(
    new ScanCommand({
      TableName: tableName,
      FilterExpression: 'begins_with(pk, :prefix)',
      ExpressionAttributeValues: {
        ':prefix': 'USER#',
      },
    })
  );

  return (result.Items || []) as User[];
}

export type { User } from './entity';
export { CreateUserSchema, UpdateUserSchema, UpdateUserRoleSchema } from './schema';
