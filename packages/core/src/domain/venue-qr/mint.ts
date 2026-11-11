import { randomBytes } from 'node:crypto';
import { ApplicationError, ErrorCode } from '../../constants';
import { isConditionalFailure } from '../class-enrollment/outcome';
import { QR_CODE_ALPHABET, QR_CODE_LENGTH } from './constants';
import { VenueQrEntity } from './entity';
import { venueRefFor } from './keys';

/** How many fresh codes to try for one slot before giving up. 40 bits make a hit very rare. */
export const MINT_MAX_ATTEMPTS = 8;
const MINT_CONCURRENCY = 25;

/**
 * One code from a CSPRNG. The alphabet has 32 symbols and a byte has 256 values, so taking the
 * low five bits of each byte is unbiased.
 */
export function generateQrCode(random: (size: number) => Uint8Array = randomBytes): string {
  const bytes = random(QR_CODE_LENGTH);
  let code = '';
  for (let i = 0; i < QR_CODE_LENGTH; i++) {
    code += QR_CODE_ALPHABET[bytes[i] & 31];
  }
  return code;
}

/**
 * Writes `count` unassigned codes into `batchId`. Each is a conditional put (`create`), so a
 * code that already exists is a collision: a new code is drawn and the put retried. Collisions
 * are an internal event and never reach a user; running out of attempts throws
 * `QR_CODE_COLLISION`.
 *
 * Conditional puts cannot ride a BatchWrite, so the slots run as parallel single puts in small
 * groups. 200 codes finish in a few seconds.
 */
export async function mintQrCodes(
  count: number,
  batchId: string,
  options: { createdAt?: string; random?: (size: number) => Uint8Array } = {}
): Promise<string[]> {
  const codes: string[] = new Array(count);
  const createdAt = options.createdAt ?? new Date().toISOString();

  const mintOne = async (slot: number): Promise<void> => {
    for (let attempt = 0; attempt < MINT_MAX_ATTEMPTS; attempt++) {
      const code = generateQrCode(options.random);
      try {
        await VenueQrEntity.create({
          code,
          batchId,
          status: 'unassigned',
          venueRef: venueRefFor({ batchId }),
          createdAt,
        }).go();
        codes[slot] = code;
        return;
      } catch (error) {
        if (!isConditionalFailure(error)) throw error;
      }
    }
    throw new ApplicationError(
      ErrorCode.QR_CODE_COLLISION,
      `Could not mint a unique code after ${MINT_MAX_ATTEMPTS} attempts`
    );
  };

  for (let start = 0; start < count; start += MINT_CONCURRENCY) {
    const slots = Array.from(
      { length: Math.min(MINT_CONCURRENCY, count - start) },
      (_, i) => start + i
    );
    await Promise.all(slots.map(mintOne));
  }
  return codes;
}
