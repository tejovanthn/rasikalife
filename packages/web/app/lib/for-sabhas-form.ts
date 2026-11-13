import {
  SABHA_REQUEST_LIMITS,
  type SabhaRequest,
  SabhaRequestSchema,
} from '@rasika/core/shared/sabha-request';
import { FOR_SABHAS_COPY } from '~/lib/for-sabhas';
import { normaliseWhatsapp } from '~/lib/qr-scan';

export type SabhaFormField = keyof typeof SABHA_REQUEST_LIMITS | 'whatsapp';

export interface SabhaFormValues {
  venueName: string;
  contactName: string;
  role: string;
  whatsapp: string;
  concertDates: string;
}

export type SabhaFormErrors = Partial<Record<SabhaFormField, string>>;

export type ParsedSabhaForm =
  | { ok: true; values: SabhaFormValues; request: SabhaRequest }
  | { ok: false; values: SabhaFormValues; errors: SabhaFormErrors };

function text(form: FormData, name: string): string {
  const value = form.get(name);
  return typeof value === 'string' ? value : '';
}

/** True when the hidden field was filled. A person never sees it. */
export function isHoneypotFilled(form: FormData): boolean {
  return text(form, 'website').trim() !== '';
}

/**
 * Reads the request form. Every field is checked and every error returned, so one submit shows
 * all that is wrong. The WhatsApp number may carry `+91`, spaces or a leading 0 (`normaliseWhatsapp`);
 * what is sent on is the ten digits. A blank optional field is left out, not sent as `''`.
 */
export function parseSabhaRequestForm(form: FormData): ParsedSabhaForm {
  const values: SabhaFormValues = {
    venueName: text(form, 'venueName').trim(),
    contactName: text(form, 'contactName').trim(),
    role: text(form, 'role').trim(),
    whatsapp: text(form, 'whatsapp').trim(),
    concertDates: text(form, 'concertDates').trim(),
  };
  const errors: SabhaFormErrors = {};
  const { errors: e } = FOR_SABHAS_COPY;

  if (!values.venueName) errors.venueName = e.venueName;
  if (!values.contactName) errors.contactName = e.contactName;
  const whatsapp = normaliseWhatsapp(values.whatsapp);
  if (!whatsapp) errors.whatsapp = e.whatsapp;
  for (const field of ['venueName', 'contactName', 'role', 'concertDates'] as const) {
    if (values[field].length > SABHA_REQUEST_LIMITS[field] && !errors[field]) {
      errors[field] = e.tooLong;
    }
  }
  if (Object.keys(errors).length > 0 || !whatsapp) return { ok: false, values, errors };

  const parsed = SabhaRequestSchema.safeParse({
    venueName: values.venueName,
    contactName: values.contactName,
    role: values.role || undefined,
    whatsapp,
    concertDates: values.concertDates || undefined,
  });
  // The checks above mirror the schema, so this holds. If they ever drift, fail closed.
  if (!parsed.success) return { ok: false, values, errors: { venueName: e.summary } };
  return { ok: true, values, request: parsed.data };
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
