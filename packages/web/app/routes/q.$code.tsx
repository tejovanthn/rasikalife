import { QrCodeSchema } from '@rasika/core/domain/venue-qr/client';
import { useRef, useState } from 'react';
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
import { getUser } from '~/lib/auth.server';
import { eventDateKey, eventZone, formatDayLabel, formatEventTime } from '~/lib/event-time';
import { isInAppBrowser } from '~/lib/in-app-browser';
import { clearQrIntent, readQrIntent, serializeQrIntent } from '~/lib/qr-intent.server';
import {
  QR_COPY,
  adminAssignUrl,
  buildFollowRows,
  buildSelection,
  doneHref,
  eyebrow,
  followsEverything,
  isModeratorRole,
  laterTitle,
  rowKey,
  scanEventTitle,
  shareConsentLabel,
  venueModeTitle,
} from '~/lib/qr-scan';
import type { FollowRowModel } from '~/lib/qr-scan';
import { generateVenueUrl } from '~/lib/url-slug';

const NO_STORE = { 'Cache-Control': 'private, no-store' };

// Every scan is read live (event state changes through the day) and the page holds a reader's
// own follow state. Never cached by the CDN or the browser.
export function headers() {
  return NO_STORE;
}

export const meta: MetaFunction = () => [
  { title: 'Follow concerts here - Rasika.life' },
  { name: 'robots', content: 'noindex, nofollow' },
];

type EventLine = {
  id: string;
  title: string;
  when: string;
  spaceName: string | null;
};

type FollowScreen = {
  rows: FollowRowModel[];
  followed: string[];
  shared: string[];
  eventId?: string;
  card?: { title: string; when: string; venueName: string | null; organiserName: string | null };
  initial: { follow: string[]; share: string[] };
};

type LoaderData =
  | { kind: 'not-found' }
  | { kind: 'unassigned' }
  | { kind: 'error' }
  | { kind: 'in-app'; url: string }
  | {
      kind: 'picker' | 'later';
      code: string;
      venueName: string;
      events: EventLine[];
    }
  | {
      kind: 'follow';
      code: string;
      venueName: string;
      label: string | null;
      mode: 'event' | 'venue';
      signedIn: boolean;
      notice: 'cancelled' | 'save-failed' | null;
      upcoming: EventLine[];
      screen: FollowScreen;
    };

function lineOf(e: {
  id: string;
  title: string;
  startDateTime: string;
  timezone?: string | null;
  spaceName?: string | null;
  venueName?: string | null;
  artists?: Array<{ title?: string | null; name: string; role?: string | null }> | null;
  artForm?: string | null;
  endDateTime?: string | null;
}): EventLine {
  const day = formatDayLabel(eventDateKey(e));
  return {
    id: e.id,
    title: scanEventTitle(e as Parameters<typeof scanEventTitle>[0]),
    when: `${day}, ${formatEventTime(e.startDateTime, eventZone(e))}`,
    spaceName: e.spaceName ?? null,
  };
}

export async function loader({ params, request }: LoaderFunctionArgs) {
  const url = new URL(request.url);
  const parsed = QrCodeSchema.safeParse((params.code ?? '').toUpperCase());
  if (!parsed.success) return data<LoaderData>({ kind: 'not-found' }, { headers: NO_STORE });
  const code = parsed.data;

  const user = await getUser(request);

  // Google sign-in does not work inside these browsers. Signed-in readers do not need it.
  if (!user && isInAppBrowser(request.headers.get('user-agent'))) {
    return data<LoaderData>({ kind: 'in-app', url: url.toString() }, { headers: NO_STORE });
  }

  const client = await createServerClient(request);
  let resolution: Awaited<ReturnType<typeof client.qr.resolve.query>>;
  try {
    resolution = await client.qr.resolve.query({ code, count: true });
  } catch (error) {
    console.error('Failed to resolve QR code:', error);
    return data<LoaderData>({ kind: 'error' }, { status: 500, headers: NO_STORE });
  }

  switch (resolution.state) {
    case 'not-found':
      return data<LoaderData>({ kind: 'not-found' }, { status: 404, headers: NO_STORE });
    case 'unassigned':
      // A moderator holding an unassigned sticker is there to set it up (decisions.md 4).
      if (user && isModeratorRole(user.role)) {
        throw redirect(adminAssignUrl(request.url, code), { headers: NO_STORE });
      }
      return data<LoaderData>({ kind: 'unassigned' }, { headers: NO_STORE });
    case 'retired':
      throw redirect(
        resolution.venue ? generateVenueUrl(resolution.venue.name, resolution.venue.id) : '/events',
        { headers: NO_STORE }
      );
  }

  const { venue, outcome } = resolution;
  const pickedId = url.searchParams.get('event');
  const eventsOf = outcome.state === 'picker' || outcome.state === 'later' ? outcome.events : [];
  const picked =
    outcome.state === 'live' ? outcome.event : (eventsOf.find(e => e.id === pickedId) ?? null);

  if (
    !picked &&
    (outcome.state === 'picker' || outcome.state === 'later') &&
    !url.searchParams.has('venue')
  ) {
    return data<LoaderData>(
      { kind: outcome.state, code, venueName: venue.name, events: eventsOf.map(lineOf) },
      { headers: NO_STORE }
    );
  }

  const rows = buildFollowRows({
    venue,
    event: picked,
    organisers:
      outcome.state === 'venue'
        ? outcome.organisers
        : outcome.state === 'later' || outcome.state === 'picker'
          ? []
          : [],
  });

  // What this reader already follows. Signed-out pages have none.
  let followed: string[] = [];
  let shared: string[] = [];
  if (user) {
    try {
      const status = await client.follow.status.query({
        targets: rows.map(r => ({ type: r.type, id: r.id })),
      });
      followed = rows.filter(r => status[r.key]?.following).map(r => r.key);
      shared = rows.filter(r => status[r.key]?.share).map(r => r.key);
    } catch (error) {
      console.error('Failed to read follow status:', error);
    }
  }

  // A returning scanner who follows everything goes straight to the end.
  if (user && followsEverything(rows, new Set(followed))) {
    throw redirect(doneHref(code, picked?.id, followed), { headers: NO_STORE });
  }

  // After a cancelled sign-in or a failed save the cookie still holds the choices.
  const signin = url.searchParams.get('signin');
  const failed = url.searchParams.get('error') === 'save';
  let initial = { follow: followed, share: shared };
  const restoring = signin === 'cancelled' || failed;
  if (restoring) {
    const intent = await readQrIntent(request);
    if (intent && intent.code === code) {
      const ok = intent.targets.filter(t => t.follow);
      initial = {
        follow: [...new Set([...followed, ...ok.map(t => rowKey(t.type, t.id))])],
        share: [...new Set([...shared, ...ok.filter(t => t.share).map(t => rowKey(t.type, t.id))])],
      };
    }
  }

  const screen: FollowScreen = {
    rows,
    followed,
    shared,
    eventId: picked?.id,
    initial,
    card: picked
      ? {
          title: scanEventTitle(picked),
          when: lineOf(picked).when,
          venueName: picked.venueName ?? venue.name,
          organiserName: picked.organiserName ?? null,
        }
      : undefined,
  };
  // The choices were read once above; the sign-in is over, so the cookie goes.
  const pageHeaders = new Headers(NO_STORE);
  if (restoring) pageHeaders.append('Set-Cookie', await clearQrIntent());
  return data<LoaderData>(
    {
      kind: 'follow',
      code,
      venueName: venue.name,
      label: resolution.label,
      mode: picked ? 'event' : 'venue',
      signedIn: Boolean(user),
      notice: signin === 'cancelled' ? 'cancelled' : failed ? 'save-failed' : null,
      upcoming: outcome.state === 'venue' ? outcome.upcoming.map(lineOf) : [],
      screen,
    },
    { headers: pageHeaders }
  );
}

type ActionData = { error: 'nothing-selected' | 'save-failed'; follow: string[]; share: string[] };

export async function action({ params, request }: ActionFunctionArgs) {
  const parsed = QrCodeSchema.safeParse((params.code ?? '').toUpperCase());
  if (!parsed.success) throw redirect('/events');
  const code = parsed.data;
  const form = await request.formData();
  const all = (name: string) => form.getAll(name).filter((v): v is string => typeof v === 'string');
  const eventId = (form.get('eventId') as string | null) || undefined;
  const values = {
    follow: all('follow'),
    share: all('share'),
    was: all('was'),
    wasShared: all('wasShared'),
    rows: all('rows'),
    intent: form.get('intent') as string | null,
  };

  const selection = buildSelection(values);
  if (!selection.ok) {
    return data<ActionData>(
      { error: 'nothing-selected', follow: values.follow, share: values.share },
      { status: 400, headers: NO_STORE }
    );
  }

  const user = await getUser(request);
  if (!user) {
    // Keep the choices across Google sign-in (qr_intent), then come back through the callback.
    const headers = new Headers(NO_STORE);
    headers.append(
      'Set-Cookie',
      await serializeQrIntent({ code, eventId, targets: selection.targets })
    );
    throw redirect(`/auth/login?redirectTo=${encodeURIComponent(`/q/${code}`)}`, { headers });
  }

  const client = await createServerClient(request);
  try {
    await client.follow.bulkSet.mutate({ qrCode: code, eventId, targets: selection.targets });
  } catch (error) {
    console.error('Failed to save QR follows:', error);
    return data<ActionData>(
      { error: 'save-failed', follow: values.follow, share: values.share },
      { status: 500, headers: NO_STORE }
    );
  }
  const headers = new Headers(NO_STORE);
  headers.append('Set-Cookie', await clearQrIntent());
  throw redirect(
    doneHref(
      code,
      eventId,
      selection.targets.filter(t => t.follow).map(t => rowKey(t.type, t.id))
    ),
    { headers }
  );
}

// ─── UI ──────────────────────────────────────────────────────────────────────────────────────

const shell = 'mx-auto w-full max-w-md px-4 py-8 space-y-6 text-lg';
const bigButton =
  'flex min-h-14 w-full items-center justify-center rounded-xl bg-primary px-6 text-xl font-semibold text-primary-foreground hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:opacity-60';
const linkButton =
  'flex min-h-14 w-full items-center justify-center rounded-xl border border-input px-6 text-lg font-medium hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring';

function Message({
  title,
  body,
  action,
}: { title: string; body?: string; action?: { label: string; to: string } }) {
  return (
    <main className={shell}>
      <h1 className="text-3xl font-bold leading-tight">{title}</h1>
      {body && <p className="text-muted-foreground">{body}</p>}
      {action && (
        <Link to={action.to} className={bigButton}>
          {action.label}
        </Link>
      )}
    </main>
  );
}

function InApp({ url }: { url: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <main className={shell}>
      <h1 className="text-3xl font-bold leading-tight">{QR_COPY.inApp.title}</h1>
      <p className="text-muted-foreground">{QR_COPY.inApp.body}</p>
      {/* Readable and selectable without JavaScript. */}
      <input
        readOnly
        value={url}
        aria-label="Link"
        onFocus={event => event.currentTarget.select()}
        className="w-full rounded-lg border border-input bg-background px-3 py-3 text-base"
      />
      <button
        type="button"
        className={bigButton}
        onClick={async () => {
          try {
            await navigator.clipboard.writeText(url);
            setCopied(true);
          } catch {
            // The field above is selectable by hand.
          }
        }}
      >
        {copied ? QR_COPY.inApp.copied : QR_COPY.inApp.button}
      </button>
    </main>
  );
}

function EventList({ code, events }: { code: string; events: EventLine[] }) {
  return (
    <ul className="space-y-3">
      {events.map(e => (
        <li key={e.id}>
          <Link
            to={`/q/${code}?event=${encodeURIComponent(e.id)}`}
            className="block min-h-14 rounded-xl border bg-card p-4 hover:bg-accent"
          >
            <span className="block text-xl font-semibold">{e.title}</span>
            <span className="block text-base text-muted-foreground">
              {e.when}
              {e.spaceName ? `, ${e.spaceName}` : ''}
            </span>
          </Link>
        </li>
      ))}
    </ul>
  );
}

function FollowForm({ d }: { d: Extract<LoaderData, { kind: 'follow' }> }) {
  const actionData = useActionData<ActionData>();
  const navigation = useNavigation();
  const formRef = useRef<HTMLFormElement>(null);
  const saving = navigation.state === 'submitting';
  const { screen } = d;
  // After a failed post the ticks come back from the action, otherwise from the loader.
  const follow = new Set(actionData?.follow ?? screen.initial.follow);
  const share = new Set(actionData?.share ?? screen.initial.share);
  const followedBefore = new Set(screen.followed);

  const error =
    actionData?.error === 'nothing-selected'
      ? QR_COPY.follow.nothingSelected
      : actionData?.error === 'save-failed' || d.notice === 'save-failed'
        ? QR_COPY.follow.saveFailed
        : d.notice === 'cancelled'
          ? QR_COPY.follow.signInCancelled
          : null;

  function tickAll() {
    const boxes = formRef.current?.querySelectorAll<HTMLInputElement>('input[name="follow"]');
    for (const box of boxes ?? []) box.checked = true;
  }

  return (
    <Form method="post" ref={formRef} className="space-y-5">
      {screen.eventId && <input type="hidden" name="eventId" value={screen.eventId} />}
      {screen.rows.map(r => (
        <input key={`r-${r.key}`} type="hidden" name="rows" value={r.key} />
      ))}
      {screen.followed.map(k => (
        <input key={`w-${k}`} type="hidden" name="was" value={k} />
      ))}
      {screen.shared.map(k => (
        <input key={`s-${k}`} type="hidden" name="wasShared" value={k} />
      ))}

      <div className="flex items-baseline justify-between gap-4">
        <h2 className="text-2xl font-bold">{QR_COPY.follow.sectionHeading}</h2>
        {/* Without JavaScript this submits as "follow all"; with it, it only ticks the rows. */}
        <button
          type="submit"
          name="intent"
          value="all"
          className="min-h-11 text-lg font-medium text-primary underline underline-offset-4"
          onClick={event => {
            event.preventDefault();
            tickAll();
          }}
        >
          {QR_COPY.follow.followAll}
        </button>
      </div>

      <ul className="space-y-3">
        {screen.rows.map(r => {
          const id = `f-${r.key}`;
          return (
            <li key={r.key} className="rounded-xl border bg-card">
              <input
                id={id}
                type="checkbox"
                name="follow"
                value={r.key}
                defaultChecked={follow.has(r.key)}
                className="peer sr-only"
              />
              <label
                htmlFor={id}
                className="flex min-h-16 cursor-pointer items-center justify-between gap-4 p-4 peer-focus-visible:[&_.sw]:ring-2 peer-focus-visible:[&_.sw]:ring-ring peer-checked:[&_.sw]:bg-primary peer-checked:[&_.knob]:translate-x-6"
              >
                <span className="min-w-0">
                  <span className="block text-xl font-semibold">{r.name}</span>
                  <span className="block text-base text-muted-foreground">
                    {r.subtitle}
                    {followedBefore.has(r.key) ? ` · ${QR_COPY.follow.following}` : ''}
                  </span>
                </span>
                <span
                  aria-hidden="true"
                  className="sw relative h-8 w-14 shrink-0 rounded-full border border-input bg-muted transition-colors"
                >
                  <span className="knob absolute left-0.5 top-0.5 h-6 w-6 rounded-full bg-background shadow transition-transform" />
                </span>
              </label>
              {r.type !== 'artist' && (
                <label className="hidden items-start gap-3 border-t p-4 text-base peer-checked:flex">
                  <input
                    type="checkbox"
                    name="share"
                    value={r.key}
                    defaultChecked={share.has(r.key)}
                    className="mt-1 h-6 w-6 shrink-0"
                  />
                  <span>{shareConsentLabel(r.name)}</span>
                </label>
              )}
            </li>
          );
        })}
      </ul>
      <p className="text-base text-muted-foreground">{QR_COPY.follow.shareHelper}</p>

      {error && (
        <p role="alert" className="rounded-lg border border-destructive p-3 text-destructive">
          {error}
        </p>
      )}

      <button type="submit" className={bigButton} disabled={saving}>
        {saving
          ? QR_COPY.follow.saving
          : d.signedIn
            ? QR_COPY.follow.signedIn
            : QR_COPY.follow.signedOut}
      </button>
      <p className="text-base text-muted-foreground">{QR_COPY.follow.footerNote}</p>
      <Link
        to="/privacy/following"
        className="block min-h-11 text-base underline underline-offset-4"
      >
        {QR_COPY.follow.footerLink}
      </Link>
    </Form>
  );
}

export default function ScanPage() {
  const d = useLoaderData<LoaderData>();
  switch (d.kind) {
    case 'not-found':
      return (
        <Message
          title={QR_COPY.notFound.title}
          body={QR_COPY.notFound.body}
          action={{ label: QR_COPY.notFound.action, to: '/events' }}
        />
      );
    case 'unassigned':
      return (
        <Message
          title={QR_COPY.unassigned.title}
          body={QR_COPY.unassigned.body}
          action={{ label: QR_COPY.unassigned.action, to: '/events' }}
        />
      );
    case 'error':
      return (
        <Message
          title={QR_COPY.error.title}
          body={QR_COPY.error.body}
          action={{ label: QR_COPY.error.action, to: '.' }}
        />
      );
    case 'in-app':
      return <InApp url={d.url} />;
    case 'picker':
      return (
        <main className={shell}>
          <p className="text-base text-muted-foreground">{eyebrow(d.venueName)}</p>
          <h1 className="text-3xl font-bold leading-tight">{QR_COPY.picker.title}</h1>
          <EventList code={d.code} events={d.events} />
        </main>
      );
    case 'later':
      return (
        <main className={shell}>
          <h1 className="text-3xl font-bold leading-tight">{laterTitle(d.venueName)}</h1>
          <EventList code={d.code} events={d.events} />
          <Link to={`/q/${d.code}/add`} className={linkButton}>
            {QR_COPY.later.action}
          </Link>
        </main>
      );
    case 'follow':
      return (
        <main className={shell}>
          <header className="space-y-1">
            <p className="text-base font-medium text-muted-foreground">{eyebrow(d.venueName)}</p>
            {d.label && <p className="text-base text-muted-foreground">{d.label}</p>}
          </header>
          {d.mode === 'event' && d.screen.card ? (
            <section className="space-y-1">
              <h1 className="text-3xl font-bold leading-tight">{d.screen.card.title}</h1>
              <p className="text-muted-foreground">{d.screen.card.when}</p>
              {d.screen.card.venueName && (
                <p className="text-muted-foreground">{d.screen.card.venueName}</p>
              )}
              {d.screen.card.organiserName && (
                <p className="text-muted-foreground">{d.screen.card.organiserName}</p>
              )}
            </section>
          ) : (
            <section className="space-y-2">
              <h1 className="text-3xl font-bold leading-tight">{venueModeTitle(d.venueName)}</h1>
              <p className="text-muted-foreground">{QR_COPY.venue.body}</p>
            </section>
          )}
          <FollowForm d={d} />
          {d.mode === 'venue' && (
            <>
              {d.upcoming.length > 0 && (
                <section className="space-y-3">
                  <h2 className="text-2xl font-bold">{QR_COPY.venue.listHeading}</h2>
                  <ul className="space-y-3">
                    {d.upcoming.map(e => (
                      <li key={e.id}>
                        <Link
                          to={`/events/${e.id}`}
                          className="block min-h-14 rounded-xl border bg-card p-4 hover:bg-accent"
                        >
                          <span className="block text-xl font-semibold">{e.title}</span>
                          <span className="block text-base text-muted-foreground">{e.when}</span>
                        </Link>
                      </li>
                    ))}
                  </ul>
                </section>
              )}
              <Link to={`/q/${d.code}/add`} className={linkButton}>
                {QR_COPY.venue.action}
              </Link>
            </>
          )}
        </main>
      );
  }
}
