import { describe, expect, it } from 'vitest';
import { maskWhatsapp, toAdminDetail, toAdminListRow, withoutSecrets } from './admin-view';

describe('maskWhatsapp', () => {
  it('shows only the last four digits', () => {
    expect(maskWhatsapp('9845012345')).toBe('+91 ••••• •2345');
  });
  it('is null for no number, and fully dotted for an odd one', () => {
    expect(maskWhatsapp(undefined)).toBeNull();
    expect(maskWhatsapp('')).toBeNull();
    expect(maskWhatsapp('123')).toBe('+91 ••••• ••••');
  });
});

describe('user shapes', () => {
  const user = {
    id: 'u',
    name: 'A',
    email: 'a@x.com',
    role: 'editor',
    unsubscribeToken: 'T',
    whatsappNumber: '9845012345',
  } as never;

  it('withoutSecrets removes the token and keeps the rest', () => {
    const out = withoutSecrets({ id: 'u', unsubscribeToken: 'T', name: 'A' });
    expect(out).toEqual({ id: 'u', name: 'A' });
  });

  it('the list row has no number and no token; the detail has the number only', () => {
    expect(JSON.stringify(toAdminListRow(user))).not.toMatch(/9845012345|"T"/);
    expect(toAdminDetail(user).whatsappNumber).toBe('9845012345');
    expect(toAdminDetail(user)).not.toHaveProperty('unsubscribeToken');
  });
});
