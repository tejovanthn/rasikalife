import { WhatsappNumberSchema } from '@rasika/core/domain/user/client';
import { z } from 'zod';
import { FOR_SABHAS_COPY } from '~/lib/for-sabhas';
import { HELP_WHATSAPP_NUMBER } from '~/lib/help-request';
import { normaliseWhatsapp } from '~/lib/qr-scan';

/** Short, so the `wa.me` link stays well under 2,000 characters even when every letter escapes. */
export const SABHA_FORM_LIMITS = {
  venueName: 100,
  role: 60,
  email: 100,
} as const;

export type SabhaFormField = 'venueName' | 'role' | 'whatsapp' | 'email';

export interface SabhaFormValues {
  venueName: string;
  role: string;
  whatsapp: string;
  email: string;
}

export type SabhaFormErrors = Partial<Record<SabhaFormField, string>>;

/** What goes into the WhatsApp message. `whatsapp` is the ten national digits. */
export interface SabhaRequest {
  venueName: string;
  role?: string;
  whatsapp: string;
  email: string;
}

export type ParsedSabhaForm =
  | { ok: true; values: SabhaFormValues; request: SabhaRequest }
  | { ok: false; values: SabhaFormValues; errors: SabhaFormErrors };

function text(form: FormData, name: string): string {
  const value = form.get(name);
  return typeof value === 'string' ? value : '';
}

/**
 * Reads the request form. Every field is checked and every error returned, so one submit shows
 * all that is wrong. The WhatsApp number may carry `+91`, spaces or a leading 0 (`normaliseWhatsapp`);
 * what goes on is the ten digits, held to `WhatsappNumberSchema`. A blank role is left out.
 */
export function parseSabhaRequestForm(form: FormData): ParsedSabhaForm {
  const values: SabhaFormValues = {
    venueName: text(form, 'venueName').trim(),
    role: text(form, 'role').trim(),
    whatsapp: text(form, 'whatsapp').trim(),
    email: text(form, 'email').trim(),
  };
  const errors: SabhaFormErrors = {};
  const { errors: e } = FOR_SABHAS_COPY;

  if (!values.venueName) errors.venueName = e.venueName;
  const number = WhatsappNumberSchema.safeParse(normaliseWhatsapp(values.whatsapp) ?? '');
  if (!number.success) errors.whatsapp = e.whatsapp;
  if (!z.string().email().safeParse(values.email).success) errors.email = e.email;
  for (const field of ['venueName', 'role', 'email'] as const) {
    if (values[field].length > SABHA_FORM_LIMITS[field] && !errors[field]) {
      errors[field] = e.tooLong;
    }
  }
  if (Object.keys(errors).length > 0 || !number.success) return { ok: false, values, errors };

  return {
    ok: true,
    values,
    request: {
      venueName: values.venueName,
      ...(values.role ? { role: values.role } : {}),
      whatsapp: number.data,
      email: values.email,
    },
  };
}

/** The message the visitor sends to the owner. Plain lines; a blank role is left out. */
export function buildSabhaMessage(request: SabhaRequest): string {
  const m = FOR_SABHAS_COPY.message;
  return [
    m.intro.replace('{sabha}', () => request.venueName),
    request.role ? m.role.replace('{role}', () => request.role ?? '') : '',
    m.whatsapp.replace('{number}', request.whatsapp),
    m.email.replace('{email}', () => request.email),
    m.source,
  ]
    .filter(Boolean)
    .join('\n');
}

/** The `wa.me` link that opens WhatsApp to the owner with the message filled in. */
export function sabhaWhatsAppUrl(request: SabhaRequest): string {
  return `https://wa.me/${HELP_WHATSAPP_NUMBER}?text=${encodeURIComponent(buildSabhaMessage(request))}`;
}

/**
 * The sabha dashboard lives beside the site: `rasika.life` to `sabha.rasika.life`, and the same
 * for a stage. Same rule as `adminOrigin`.
 */
export function sabhaOrigin(requestUrl: string): string {
  const url = new URL(requestUrl);
  const host = url.hostname.replace(/^www\./, '');
  if (host === 'localhost' || /^\d+\.\d+\.\d+\.\d+$/.test(host)) return 'https://sabha.rasika.life';
  return `https://sabha.${host}`;
}
