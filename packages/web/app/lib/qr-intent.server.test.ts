import { describe, expect, it } from 'vitest';

import { vi } from 'vitest';
vi.mock('sst', () => ({ Resource: {} }));

import { QR_INTENT_TTL_SEC } from '@rasika/core/domain/venue-qr/client';
import {
  clearQrIntent,
  createQrIntentCookie,
  intentMatchesAttempt,
  readQrIntent,
  serializeQrIntent,
} from './qr-intent.server';
import type { QrIntent } from './qr-intent.server';

const cookie = createQrIntentCookie('test-key', false);
const intent: Omit<QrIntent, 'nonce'> = {
  code: 'ABCDEFGH',
  eventId: 'e1',
  targets: [
    { type: 'venue', id: 'v1', follow: true, share: true },
    { type: 'artist', id: 'a1', follow: true },
  ],
};
const requestWith = (setCookie: string) =>
  new Request('https://rasika.life/auth/callback', {
    headers: { Cookie: setCookie.split(';')[0] },
  });

describe('qr_intent cookie', () => {
  it('round-trips a signed intent', async () => {
    const header = await serializeQrIntent(intent, 1_000, cookie);
    expect(header).toMatch(/HttpOnly/i);
    expect(header).toMatch(/SameSite=Lax/i);
    expect(header).toContain(`Max-Age=${QR_INTENT_TTL_SEC}`);
    expect(await readQrIntent(requestWith(header), 2_000, cookie)).toMatchObject(intent);
  });

  it('expires after 15 minutes', async () => {
    const header = await serializeQrIntent(intent, 0, cookie);
    const edge = QR_INTENT_TTL_SEC * 1000;
    expect(await readQrIntent(requestWith(header), edge - 1, cookie)).not.toBeNull();
    expect(await readQrIntent(requestWith(header), edge, cookie)).toBeNull();
  });

  it('rejects a tampered value', async () => {
    const header = await serializeQrIntent(intent, 0, cookie);
    const [name, value] = header.split(';')[0].split('=');
    const bad = `${name}=${value.slice(0, -3)}AAA`;
    expect(await readQrIntent(requestWith(bad), 1, cookie)).toBeNull();
  });

  it('rejects a cookie signed with another key', async () => {
    const other = createQrIntentCookie('other-key', false);
    const header = await serializeQrIntent(intent, 0, other);
    expect(await readQrIntent(requestWith(header), 1, cookie)).toBeNull();
  });

  it('is null when absent or when the payload fails the follow schema', async () => {
    expect(await readQrIntent(new Request('https://rasika.life/'), 1, cookie)).toBeNull();
    const bad = await serializeQrIntent({ ...intent, targets: [] }, 0, cookie);
    expect(await readQrIntent(requestWith(bad), 1, cookie)).toBeNull();
  });

  it('clearing sets an expired cookie', async () => {
    expect(await clearQrIntent(cookie)).toMatch(/Max-Age=0/);
  });

  it('carries a random nonce, new for each cookie', async () => {
    const a = await readQrIntent(
      requestWith(await serializeQrIntent(intent, 0, cookie)),
      1,
      cookie
    );
    const b = await readQrIntent(
      requestWith(await serializeQrIntent(intent, 0, cookie)),
      1,
      cookie
    );
    expect(a?.nonce).toHaveLength(36);
    expect(a?.nonce).not.toBe(b?.nonce);
  });

  it('applies only for the sign-in attempt that stored the same nonce', () => {
    expect(intentMatchesAttempt({ nonce: 'n'.repeat(16) }, 'n'.repeat(16))).toBe(true);
    expect(intentMatchesAttempt({ nonce: 'n'.repeat(16) }, 'm'.repeat(16))).toBe(false);
    expect(intentMatchesAttempt({ nonce: 'n'.repeat(16) }, undefined)).toBe(false);
    expect(intentMatchesAttempt(null, 'n'.repeat(16))).toBe(false);
  });
});
