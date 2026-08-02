import { Service } from 'electrodb';
import { ClassPackEntity } from '../class-pack/entity';
import { ClassSessionEntity } from '../class-session/entity';
import { ClassEnrollmentEntity } from './entity';

/**
 * The three entities that move credits, in one ElectroDB `Service` so they can be written in a
 * single DynamoDB transaction.
 *
 * Every credit movement is two writes that have to land together: the row that records *why*
 * (a signed pack, or a session changing status) and the atomic `ADD` on the enrollment's
 * running total. Doing them as two calls means a crash between them leaves a balance that
 * disagrees with its own ledger, and the ledger is the product — "why do I have seven credits"
 * is the question this whole design exists to answer.
 *
 * It lives under `class-enrollment` because the enrollment is the row every one of those
 * transactions touches.
 *
 * This module holds the `Service` and nothing else. The Service is built at import time and
 * throws on anything that is not a real entity, so a test that mocks an entity cannot import
 * a module that also holds helpers it needs. Those live in `outcome.ts`.
 */
export const ClassLedgerService = new Service({
  classEnrollment: ClassEnrollmentEntity,
  classPack: ClassPackEntity,
  classSession: ClassSessionEntity,
});
