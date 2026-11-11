import { describe, expect, it } from 'vitest';
import {
  NOTIFY_COPY,
  normalizeWhatsappInput,
  parsePrefChange,
  unsubscribeMessage,
  whatsappError,
  whatsappUnconfirmed,
} from './notifications';

const form = (entries: Record<string, string>) => {
  const f = new FormData();
  for (const [k, v] of Object.entries(entries)) f.set(k, v);
  return f;
};

describe('unsubscribeMessage', () => {
  it('uses the Copy text for each kind', () => {
    expect(unsubscribeMessage('digest')).toBe("You won't get the weekly list any more.");
    expect(unsubscribeMessage('reminders')).toBe(
      "You won't get day-before reminders by email any more."
    );
    expect(unsubscribeMessage('all')).toBe("You're unsubscribed from all rasika.life email.");
  });
});

describe('parsePrefChange', () => {
  it('reads one known toggle', () => {
    expect(parsePrefChange(form({ key: 'notifyPush', value: 'true' }))).toEqual({
      notifyPush: true,
    });
    expect(parsePrefChange(form({ key: 'notifyDigest', value: 'false' }))).toEqual({
      notifyDigest: false,
    });
  });
  it('refuses an unknown key or value', () => {
    expect(parsePrefChange(form({ key: 'role', value: 'true' }))).toBeNull();
    expect(parsePrefChange(form({ key: 'notifyEmail', value: 'yes' }))).toBeNull();
    expect(parsePrefChange(form({}))).toBeNull();
  });
});

describe('whatsapp input', () => {
  it('accepts ten digits starting 6 to 9, with spaces or a prefix', () => {
    expect(normalizeWhatsappInput('98450 12345')).toBe('9845012345');
    expect(normalizeWhatsappInput('+91 98450 12345')).toBe('9845012345');
    expect(normalizeWhatsappInput('09845012345')).toBe('9845012345');
  });
  it('refuses the rest', () => {
    for (const bad of ['', '12345', '5845012345', '984501234567', 'abcdefghij']) {
      expect(normalizeWhatsappInput(bad)).toBeNull();
    }
  });
  it('asks for the number first, then the consent', () => {
    expect(whatsappError('1', true)).toBe(NOTIFY_COPY.whatsappInvalid);
    expect(whatsappError('9845012345', false)).toBe(NOTIFY_COPY.whatsappConsentMissing);
    expect(whatsappError('9845012345', true)).toBeNull();
  });
  it('labels an unverified number', () => {
    expect(whatsappUnconfirmed('9845012345')).toBe('9845012345 (not yet confirmed)');
  });
});
