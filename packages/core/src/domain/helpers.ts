import { ApplicationError, type ErrorCode } from '../constants';

export type EntityType =
  | 'artist'
  | 'award'
  | 'raga'
  | 'tala'
  | 'composition'
  | 'edit'
  | 'venue'
  | 'organiser'
  | 'festival'
  | 'event';

export function notFoundError(entity: EntityType, id: string): ApplicationError {
  const code = `${entity.toUpperCase()}_NOT_FOUND` as ErrorCode;
  return new ApplicationError(code, `${entity} with ID ${id} not found`);
}

export function createFailedError(entity: EntityType, name: string): ApplicationError {
  const code = `${entity.toUpperCase()}_CREATE_FAILED` as ErrorCode;
  return new ApplicationError(code, `Failed to create ${entity}: ${name}`);
}

export function updateFailedError(entity: EntityType, id: string): ApplicationError {
  const code = `${entity.toUpperCase()}_UPDATE_FAILED` as ErrorCode;
  return new ApplicationError(code, `${entity} with ID ${id} update failed`);
}
