import { Check } from 'lucide-react';
import type { ActionFunctionArgs, LoaderFunctionArgs, MetaFunction } from 'react-router';
import { Form, data, useActionData, useLoaderData, useNavigation } from 'react-router';
import { client, createServerClient } from '~/api.server';
import { Button } from '~/components/ui/button';
import { Input } from '~/components/ui/input';
import { Label } from '~/components/ui/label';
import { getUser } from '~/lib/auth.server';
import { clientIpFromHeaders } from '~/lib/client-ip';
import { FOR_SABHAS_COPY as COPY } from '~/lib/for-sabhas';
import {
  type SabhaFormErrors,
  type SabhaFormField,
  type SabhaFormValues,
  isHoneypotFilled,
  parseSabhaRequestForm,
  sabhaOrigin,
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

type ActionData =
  | { status: 'sent' }
  | { status: 'invalid'; values: SabhaFormValues; errors: SabhaFormErrors }
  | { status: 'failed' | 'rate-limited'; values: SabhaFormValues };

const NO_STORE = { 'Cache-Control': 'private, no-store' };

/** Works as a plain form post. Never throws: a failed send is a message on the page. */
export async function action({ request }: ActionFunctionArgs) {
  const form = await request.formData();
  if (isHoneypotFilled(form)) return data<ActionData>({ status: 'sent' }, { headers: NO_STORE });

  const parsed = parseSabhaRequestForm(form);
  if (!parsed.ok) {
    return data<ActionData>(
      { status: 'invalid', values: parsed.values, errors: parsed.errors },
      { status: 400, headers: NO_STORE }
    );
  }
  try {
    const result = await client.sabhaRequest.submit.mutate({
      ...parsed.request,
      website: '',
      clientIp: clientIpFromHeaders(request.headers),
    });
    if (result.status === 'sent')
      return data<ActionData>({ status: 'sent' }, { headers: NO_STORE });
    if (result.status === 'rate-limited') {
      return data<ActionData>(
        { status: 'rate-limited', values: parsed.values },
        { status: 429, headers: NO_STORE }
      );
    }
  } catch (error) {
    console.error('Failed to submit a sabha request:', error);
  }
  return data<ActionData>(
    { status: 'failed', values: parsed.values },
    { status: 503, headers: NO_STORE }
  );
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
  const sent = result?.status === 'sent';
  const values = result && 'values' in result ? result.values : undefined;
  const errors = result?.status === 'invalid' ? result.errors : {};

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
        {sent ? (
          <output className="rounded-lg border border-border bg-card block p-4 text-base font-medium">
            {COPY.thanks}
          </output>
        ) : (
          <Form method="post" action="/for-sabhas" className="space-y-5">
            {result?.status === 'invalid' && (
              <p role="alert" className="text-sm font-medium text-destructive">
                {COPY.errors.summary}
              </p>
            )}
            {result?.status === 'failed' && (
              <p role="alert" className="text-sm font-medium text-destructive">
                {COPY.errors.failed}
              </p>
            )}
            {result?.status === 'rate-limited' && (
              <p role="alert" className="text-sm font-medium text-destructive">
                {COPY.errors.rateLimited}
              </p>
            )}
            <Field
              name="venueName"
              label={COPY.labels.venueName}
              defaultValue={values?.venueName}
              error={errors.venueName}
              required
              autoComplete="organization"
              maxLength={200}
            />
            <Field
              name="contactName"
              label={COPY.labels.contactName}
              defaultValue={values?.contactName}
              error={errors.contactName}
              required
              autoComplete="name"
              maxLength={200}
            />
            <Field
              name="role"
              label={COPY.labels.role}
              hint={COPY.hints.role}
              defaultValue={values?.role}
              error={errors.role}
              autoComplete="organization-title"
              maxLength={200}
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
              name="concertDates"
              label={COPY.labels.concertDates}
              hint={COPY.hints.concertDates}
              defaultValue={values?.concertDates}
              error={errors.concertDates}
              maxLength={1000}
            />
            {/* Honeypot. Off screen, out of the tab order and hidden from screen readers. A
                script that fills every input fills this one, and the request is dropped. */}
            <div aria-hidden="true" className="absolute -left-[9999px] h-0 w-0 overflow-hidden">
              <label htmlFor="website">Leave this field empty</label>
              <input id="website" name="website" type="text" tabIndex={-1} autoComplete="off" />
            </div>
            <Button type="submit" size="lg" disabled={sending} className="w-full sm:w-auto">
              {sending ? COPY.submitting : COPY.submit}
            </Button>
          </Form>
        )}
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
