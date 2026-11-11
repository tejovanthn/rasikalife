import { AddConcertSchema, QrCodeSchema } from '@rasika/core/domain/venue-qr/client';
import { dateInTimeZone } from '@rasika/core/shared/timezone';
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
import { requireUser } from '~/lib/auth.server';
import { QR_COPY, addFormTitle, publishedMessage, submittedMessage } from '~/lib/qr-scan';

const NO_STORE = { 'Cache-Control': 'private, no-store' };

export function headers() {
  return NO_STORE;
}

export const meta: MetaFunction = () => [
  { title: 'Add a concert - Rasika.life' },
  { name: 'robots', content: 'noindex, nofollow' },
];

function codeOf(params: { code?: string }): string | null {
  const parsed = QrCodeSchema.safeParse((params.code ?? '').toUpperCase());
  return parsed.success ? parsed.data : null;
}

/** Needs sign-in; the way back is this same page. */
export async function loader({ params, request }: LoaderFunctionArgs) {
  const code = codeOf(params);
  if (!code) throw redirect('/events');
  await requireUser(request);
  const client = await createServerClient(request);
  const resolution = await client.qr.resolve.query({ code });
  if (resolution.state !== 'active') throw redirect(`/q/${code}`);
  const status = new URL(request.url).searchParams.get('done');
  return data(
    {
      code,
      venueName: resolution.venue.name,
      space: resolution.space,
      // The hall's calendar day, never the server's.
      today: dateInTimeZone(new Date(), 'Asia/Kolkata'),
      done: status === 'published' || status === 'review' ? status : null,
    },
    { headers: NO_STORE }
  );
}

export async function action({ params, request }: ActionFunctionArgs) {
  const code = codeOf(params);
  if (!code) throw redirect('/events');
  await requireUser(request);
  const form = await request.formData();
  const text = (name: string) => {
    const v = form.get(name);
    return typeof v === 'string' && v.trim() ? v : undefined;
  };
  const parsed = AddConcertSchema.safeParse({
    code,
    title: text('title') ?? '',
    date: text('date') ?? '',
    startTime: text('startTime') ?? '',
    spaceId: text('spaceId'),
    organiserName: text('organiserName'),
    artists: text('artists'),
    notes: text('notes'),
  });
  if (!parsed.success) {
    return data({ error: 'invalid' as const }, { status: 400, headers: NO_STORE });
  }
  const client = await createServerClient(request);
  try {
    const result = await client.event.submitFromQr.mutate(parsed.data);
    throw redirect(`/q/${code}/add?done=${result.published ? 'published' : 'review'}`, {
      headers: NO_STORE,
    });
  } catch (error) {
    if (error instanceof Response) throw error;
    console.error('Failed to submit concert from QR:', error);
    return data({ error: 'failed' as const }, { status: 500, headers: NO_STORE });
  }
}

const field = 'min-h-12 w-full rounded-lg border border-input bg-background px-3 text-lg';
const button =
  'flex min-h-14 w-full items-center justify-center rounded-xl bg-primary px-6 text-xl font-semibold text-primary-foreground hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-60';

export default function AddConcertHere() {
  const d = useLoaderData<typeof loader>();
  const result = useActionData<typeof action>();
  const busy = useNavigation().state === 'submitting';
  const L = QR_COPY.add.labels;

  if (d.done) {
    return (
      <main className="mx-auto w-full max-w-md space-y-6 px-4 py-8 text-lg">
        <p>
          {d.done === 'published' ? publishedMessage(d.venueName) : submittedMessage(d.venueName)}
        </p>
        {/* The venue follow screen, so the scanner can still follow right away. */}
        <Link to={`/q/${d.code}?venue=1`} className={button}>
          {QR_COPY.follow.signedIn} {d.venueName}
        </Link>
      </main>
    );
  }

  return (
    <main className="mx-auto w-full max-w-md space-y-6 px-4 py-8 text-lg">
      <h1 className="text-3xl font-bold leading-tight">{addFormTitle(d.venueName)}</h1>

      <section className="space-y-2">
        <h2 className="text-2xl font-bold">{QR_COPY.add.optionA}</h2>
        <p className="text-muted-foreground">{QR_COPY.add.optionAHelper}</p>
        {/* The existing poster flow. TODO(spec): it cannot take a venue, space or date yet. */}
        <Link
          to="/events/new"
          className="flex min-h-14 w-full items-center justify-center rounded-xl border border-input px-6 text-lg font-medium hover:bg-accent"
        >
          {QR_COPY.add.optionA}
        </Link>
      </section>

      <Form method="post" className="space-y-4">
        <h2 className="text-2xl font-bold">{QR_COPY.add.optionB}</h2>
        <label className="block space-y-1">
          <span>{L.title}</span>
          <input name="title" required maxLength={300} className={field} />
        </label>
        <label className="block space-y-1">
          <span>{L.date}</span>
          <input name="date" type="date" required defaultValue={d.today} className={field} />
        </label>
        <label className="block space-y-1">
          <span>{L.startTime}</span>
          <input name="startTime" type="time" required className={field} />
        </label>
        {d.space && (
          <div className="space-y-1">
            <span className="block">{L.space}</span>
            <p className="font-medium">{d.space.name}</p>
            <input type="hidden" name="spaceId" value={d.space.id} />
          </div>
        )}
        <label className="block space-y-1">
          <span>{L.organiser}</span>
          <input name="organiserName" maxLength={200} className={field} />
        </label>
        <label className="block space-y-1">
          <span>{L.artists}</span>
          <textarea name="artists" rows={3} maxLength={1000} className={`${field} py-2`} />
        </label>
        <label className="block space-y-1">
          <span>{L.notes}</span>
          <textarea name="notes" rows={3} maxLength={2000} className={`${field} py-2`} />
        </label>
        {result?.error && (
          <p role="alert" className="text-destructive">
            {QR_COPY.error.body}
          </p>
        )}
        {/* TODO(spec): "Publish concert" (verified owner) needs to be known before submit; the
            partner router that would say so is phase 8. The result page says which happened. */}
        <button type="submit" className={button} disabled={busy}>
          {QR_COPY.add.submitRegular}
        </button>
      </Form>
    </main>
  );
}
