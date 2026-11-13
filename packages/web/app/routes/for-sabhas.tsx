import { Check } from 'lucide-react';
import type { ActionFunctionArgs, LoaderFunctionArgs, MetaFunction } from 'react-router';
import { Form, data, redirect, useActionData, useLoaderData, useNavigation } from 'react-router';
import { createServerClient } from '~/api.server';
import { Button } from '~/components/ui/button';
import { Input } from '~/components/ui/input';
import { Label } from '~/components/ui/label';
import { getUser } from '~/lib/auth.server';
import { FOR_SABHAS_COPY as COPY } from '~/lib/for-sabhas';
import {
  SABHA_FORM_LIMITS,
  type SabhaFormErrors,
  type SabhaFormField,
  type SabhaFormValues,
  parseSabhaRequestForm,
  sabhaOrigin,
  sabhaWhatsAppUrl,
} from '~/lib/for-sabhas-form';

const PAGE_URL = 'https://rasika.life/for-sabhas';

export const meta: MetaFunction = () => [
  { title: COPY.metaTitle },
  { name: 'description', content: COPY.metaDescription },
  { property: 'og:title', content: COPY.metaTitle },
  { property: 'og:description', content: COPY.metaDescription },
  { property: 'og:type', content: 'website' },
  { property: 'og:url', content: PAGE_URL },
  { property: 'og:image', content: 'https://rasika.life/og-image.png' },
  { tagName: 'link', rel: 'canonical', href: PAGE_URL },
];

/**
 * Signed out: the same document for everyone, cached for a week by the default policy. Signed
 * in: `rasika_session` is in the cache key and the response is `private`, so the dashboard link
 * below never reaches another reader. The page is never redirected: a secretary who is already
 * a member may still want to read it, and a crawler must always get the page.
 */
export async function loader({ request }: LoaderFunctionArgs) {
  const origin = sabhaOrigin(request.url);
  const user = await getUser(request);
  if (!user) return { sabhaUrl: origin, hasDashboard: false };
  try {
    const trpc = await createServerClient(request);
    const mine = await trpc.partner.mine.query();
    return { sabhaUrl: origin, hasDashboard: mine.length > 0 };
  } catch (error) {
    console.error('Failed to read partner memberships for /for-sabhas:', error);
    return { sabhaUrl: origin, hasDashboard: false };
  }
}

type ActionData = { status: 'invalid'; values: SabhaFormValues; errors: SabhaFormErrors };

const NO_STORE = { 'Cache-Control': 'private, no-store' };

/**
 * Works as a plain form post. Nothing is stored or emailed: a valid form answers 303 to a
 * `wa.me` link with the message filled in, so the visitor sends it from their own WhatsApp.
 */
export async function action({ request }: ActionFunctionArgs) {
  const parsed = parseSabhaRequestForm(await request.formData());
  if (!parsed.ok) {
    return data<ActionData>(
      { status: 'invalid', values: parsed.values, errors: parsed.errors },
      { status: 400, headers: NO_STORE }
    );
  }
  return redirect(sabhaWhatsAppUrl(parsed.request), { status: 303, headers: NO_STORE });
}

function Field({
  name,
  label,
  hint,
  error,
  defaultValue,
  required,
  type = 'text',
  inputMode,
  autoComplete,
  maxLength,
}: {
  name: SabhaFormField;
  label: string;
  hint?: string;
  error?: string;
  defaultValue?: string;
  required?: boolean;
  type?: string;
  inputMode?: 'tel' | 'text';
  autoComplete?: string;
  maxLength: number;
}) {
  const describedBy = [hint ? `${name}-hint` : '', error ? `${name}-error` : '']
    .filter(Boolean)
    .join(' ');
  return (
    <div className="space-y-1.5">
      <Label htmlFor={name}>{label}</Label>
      <Input
        id={name}
        name={name}
        type={type}
        inputMode={inputMode}
        autoComplete={autoComplete}
        defaultValue={defaultValue}
        required={required}
        maxLength={maxLength}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy || undefined}
        className="min-h-[44px]"
      />
      {hint && (
        <p id={`${name}-hint`} className="text-sm text-muted-foreground">
          {hint}
        </p>
      )}
      {error && (
        <p id={`${name}-error`} className="text-sm font-medium text-destructive">
          {error}
        </p>
      )}
    </div>
  );
}

export default function ForSabhasPage() {
  const { sabhaUrl, hasDashboard } = useLoaderData<typeof loader>();
  const result = useActionData<typeof action>();
  const navigation = useNavigation();
  const sending = navigation.state === 'submitting';
  const values = result?.values;
  const errors = result?.errors ?? {};

  return (
    <main className="container mx-auto px-4 py-8 max-w-3xl">
      <section className="mb-10">
        <p className="text-xs font-semibold tracking-[0.2em] uppercase text-primary mb-4">
          {COPY.eyebrow}
        </p>
        <h1 className="hero-title">{COPY.headline}</h1>
        <p className="text-lg text-muted-foreground mb-6">{COPY.intro}</p>
        <ul className="space-y-3 list-none p-0 m-0">
          {COPY.points.map(point => (
            <li key={point} className="flex items-start gap-3">
              <Check className="h-5 w-5 mt-0.5 shrink-0 text-primary" aria-hidden="true" />
              <span>{point}</span>
            </li>
          ))}
        </ul>
        {/* Pilot photo and scan count go here once the first sabha pilot has run. Leave the
            slot empty until there is a real photo and a real number to show. */}
      </section>

      <section id="request" className="mb-8 scroll-mt-20" aria-labelledby="request-heading">
        <h2 id="request-heading" className="section-heading">
          {COPY.formHeading}
        </h2>
        <Form method="post" action="/for-sabhas" className="space-y-5">
          {result?.status === 'invalid' && (
            <p role="alert" className="text-sm font-medium text-destructive">
              {COPY.errors.summary}
            </p>
          )}
          <Field
            name="venueName"
            label={COPY.labels.venueName}
            defaultValue={values?.venueName}
            error={errors.venueName}
            required
            autoComplete="organization"
            maxLength={SABHA_FORM_LIMITS.venueName}
          />
          <Field
            name="role"
            label={COPY.labels.role}
            hint={COPY.hints.role}
            defaultValue={values?.role}
            error={errors.role}
            autoComplete="organization-title"
            maxLength={SABHA_FORM_LIMITS.role}
          />
          <Field
            name="whatsapp"
            label={COPY.labels.whatsapp}
            hint={COPY.hints.whatsapp}
            defaultValue={values?.whatsapp}
            error={errors.whatsapp}
            required
            type="tel"
            inputMode="tel"
            autoComplete="tel-national"
            maxLength={20}
          />
          <Field
            name="email"
            label={COPY.labels.email}
            defaultValue={values?.email}
            error={errors.email}
            required
            type="email"
            autoComplete="email"
            maxLength={SABHA_FORM_LIMITS.email}
          />
          <div className="space-y-2">
            <Button type="submit" size="lg" disabled={sending} className="w-full sm:w-auto">
              {sending ? COPY.submitting : COPY.submit}
            </Button>
            <p className="text-sm text-muted-foreground">{COPY.nextStep}</p>
          </div>
        </Form>
      </section>

      <p className="text-sm text-muted-foreground flex flex-wrap items-center gap-x-4 gap-y-2">
        <a href={sabhaUrl} className="inline-flex min-h-[44px] items-center underline">
          {COPY.alreadyInvited}
        </a>
        {hasDashboard && (
          <a
            href={sabhaUrl}
            className="inline-flex min-h-[44px] items-center font-medium underline"
          >
            {COPY.dashboard}
          </a>
        )}
      </p>
    </main>
  );
}
