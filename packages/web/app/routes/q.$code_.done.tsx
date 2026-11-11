import { QrCodeSchema } from '@rasika/core/domain/venue-qr/client';
import type { ActionFunctionArgs, LoaderFunctionArgs, MetaFunction } from 'react-router';
import {
  Form,
  Link,
  data,
  redirect,
  useActionData,
  useLoaderData,
  useNavigation,
} from 'react-router';
import { createServerClient } from '~/api.server';
import { PushButton } from '~/components/push/push-button';
import { getUser } from '~/lib/auth.server';
import { parseSubscriptionForm } from '~/lib/push';
import { QR_COPY, normaliseWhatsapp, parseDoneKeys, summaryLine } from '~/lib/qr-scan';

const NO_STORE = { 'Cache-Control': 'private, no-store' };

export function headers() {
  return NO_STORE;
}

export const meta: MetaFunction = () => [
  { title: "You're all set - Rasika.life" },
  { name: 'robots', content: 'noindex, nofollow' },
];

function codeOf(params: { code?: string }): string | null {
  const parsed = QrCodeSchema.safeParse((params.code ?? '').toUpperCase());
  return parsed.success ? parsed.data : null;
}

export async function loader({ params, request }: LoaderFunctionArgs) {
  const code = codeOf(params);
  if (!code) throw redirect('/events');
  const user = await getUser(request);
  // Signed out: back to the scan page, where the follow screen starts.
  if (!user) throw redirect(`/q/${code}`);

  const url = new URL(request.url);
  const keys = parseDoneKeys(url.searchParams.get('t'));
  const eventId = url.searchParams.get('e') || undefined;
  const client = await createServerClient(request);

  const [follows, me, logged] = await Promise.all([
    client.follow.mine.query().catch(() => []),
    client.user.me.query().catch(() => null),
    eventId ? client.concertLog.get.query({ eventId }).catch(() => null) : Promise.resolve(null),
  ]);
  const wanted = new Set(keys);
  const names = follows
    .filter(f => wanted.has(`${f.targetType}:${f.targetId}`))
    .map(f => f.targetName);

  const meRow = me as { whatsappNumber?: string; whatsappPromptDismissedAt?: string } | null;
  return data(
    {
      code,
      eventId: eventId ?? null,
      // Public by design. Null (unset) hides the push button.
      vapidKey: process.env.VAPID_PUBLIC_KEY || null,
      summary: summaryLine(names),
      inBook: Boolean(logged),
      showWhatsapp: Boolean(meRow) && !meRow?.whatsappNumber && !meRow?.whatsappPromptDismissedAt,
    },
    { headers: NO_STORE }
  );
}

type ActionResult =
  | { ok: true; intent: 'book' | 'whatsapp' | 'dismiss' | 'push' }
  | { ok: false; intent: 'whatsapp'; error: 'invalid' | 'consent' | 'failed' }
  | { ok: false; intent: 'book'; error: 'failed' };

export async function action({ params, request }: ActionFunctionArgs) {
  const code = codeOf(params);
  if (!code) throw redirect('/events');
  const user = await getUser(request);
  if (!user) throw redirect(`/q/${code}`);
  const form = await request.formData();
  const intent = form.get('intent');
  const client = await createServerClient(request);

  if (intent === 'book') {
    const eventId = form.get('eventId');
    if (typeof eventId !== 'string' || !eventId)
      return data<ActionResult>({ ok: false, intent: 'book', error: 'failed' }, { status: 400 });
    try {
      await client.concertLog.upsert.mutate({ eventId });
      return data<ActionResult>({ ok: true, intent: 'book' });
    } catch (error) {
      console.error('Failed to add to concert book:', error);
      return data<ActionResult>({ ok: false, intent: 'book', error: 'failed' }, { status: 500 });
    }
  }

  if (intent === 'push') {
    const subscription = parseSubscriptionForm(form);
    if (!subscription)
      return data<ActionResult>({ ok: false, intent: 'book', error: 'failed' }, { status: 400 });
    try {
      await client.notify.subscribePush.mutate(subscription);
      return data<ActionResult>({ ok: true, intent: 'push' });
    } catch (error) {
      console.error('Failed to save push subscription:', error);
      return data<ActionResult>({ ok: false, intent: 'book', error: 'failed' }, { status: 500 });
    }
  }

  if (intent === 'dismiss') {
    try {
      await client.notify.dismissWhatsappPrompt.mutate();
    } catch (error) {
      console.error('Failed to dismiss WhatsApp prompt:', error);
    }
    return data<ActionResult>({ ok: true, intent: 'dismiss' });
  }

  if (intent === 'whatsapp') {
    const number = normaliseWhatsapp(String(form.get('number') ?? ''));
    if (!number) {
      return data<ActionResult>(
        { ok: false, intent: 'whatsapp', error: 'invalid' },
        { status: 400 }
      );
    }
    if (form.get('consent') !== 'on') {
      return data<ActionResult>(
        { ok: false, intent: 'whatsapp', error: 'consent' },
        { status: 400 }
      );
    }
    try {
      await client.notify.setWhatsapp.mutate({ number, consent: true });
      return data<ActionResult>({ ok: true, intent: 'whatsapp' });
    } catch (error) {
      console.error('Failed to save WhatsApp number:', error);
      return data<ActionResult>(
        { ok: false, intent: 'whatsapp', error: 'failed' },
        { status: 500 }
      );
    }
  }
  return data<ActionResult>({ ok: false, intent: 'book', error: 'failed' }, { status: 400 });
}

const button =
  'flex min-h-14 w-full items-center justify-center rounded-xl bg-primary px-6 text-xl font-semibold text-primary-foreground hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-60';

export default function QrDone() {
  const d = useLoaderData<typeof loader>();
  const result = useActionData<ActionResult>();
  const navigation = useNavigation();
  const busy = navigation.state === 'submitting';
  const booked = d.inBook || (result?.ok === true && result.intent === 'book');
  const whatsappDone =
    result?.ok === true && (result.intent === 'whatsapp' || result.intent === 'dismiss');

  return (
    <main className="mx-auto w-full max-w-md space-y-6 px-4 py-8 text-lg">
      <h1 className="text-3xl font-bold leading-tight">{QR_COPY.done.title}</h1>
      {d.summary && <p>{d.summary}</p>}

      <PushButton vapidKey={d.vapidKey} />

      {d.eventId &&
        (booked ? (
          <p className="font-medium">{QR_COPY.done.concertBookDone}</p>
        ) : (
          <Form method="post">
            <input type="hidden" name="intent" value="book" />
            <input type="hidden" name="eventId" value={d.eventId} />
            <button type="submit" className={button} disabled={busy}>
              {QR_COPY.done.concertBook}
            </button>
          </Form>
        ))}

      {result?.intent === 'whatsapp' && result.ok && (
        <output className="block">{QR_COPY.whatsapp.saved}</output>
      )}
      {d.showWhatsapp && !whatsappDone && (
        <section className="space-y-4 rounded-xl border bg-card p-4">
          <h2 className="text-2xl font-bold">{QR_COPY.whatsapp.heading}</h2>
          <Form method="post" className="space-y-4">
            <input type="hidden" name="intent" value="whatsapp" />
            <label className="block space-y-2">
              <span className="block text-base">{QR_COPY.whatsapp.label}</span>
              <span className="flex items-center gap-2">
                <span className="text-xl">{QR_COPY.whatsapp.prefix}</span>
                <input
                  name="number"
                  type="tel"
                  inputMode="numeric"
                  autoComplete="tel-national"
                  placeholder={QR_COPY.whatsapp.placeholder}
                  className="min-h-12 w-full rounded-lg border border-input bg-background px-3 text-xl"
                />
              </span>
            </label>
            <label className="flex items-start gap-3 text-base">
              {/* Never pre-ticked: consent is its own act (whatsapp-v1). */}
              <input type="checkbox" name="consent" className="mt-1 h-6 w-6 shrink-0" />
              <span>{QR_COPY.whatsapp.consent}</span>
            </label>
            {result && !result.ok && result.intent === 'whatsapp' && (
              <p role="alert" className="text-destructive">
                {result.error === 'invalid'
                  ? QR_COPY.whatsapp.invalid
                  : result.error === 'consent'
                    ? QR_COPY.whatsapp.consentMissing
                    : QR_COPY.error.body}
              </p>
            )}
            <button type="submit" className={button} disabled={busy}>
              {QR_COPY.whatsapp.save}
            </button>
          </Form>
          <Form method="post">
            <input type="hidden" name="intent" value="dismiss" />
            <button type="submit" className="min-h-11 text-base underline underline-offset-4">
              {QR_COPY.whatsapp.dismiss}
            </button>
          </Form>
        </section>
      )}

      <Link to="/me/following" className="block min-h-11 text-lg underline underline-offset-4">
        {QR_COPY.done.manage}
      </Link>
    </main>
  );
}
