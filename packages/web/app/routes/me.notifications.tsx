import { useEffect, useState } from 'react';
import type { ActionFunctionArgs, LoaderFunctionArgs, MetaFunction } from 'react-router';
import { data, useFetcher, useLoaderData } from 'react-router';
import { toast } from 'sonner';
import { createServerClient } from '~/api.server';
import { Button } from '~/components/ui/button';
import { requireUser } from '~/lib/auth.server';
import {
  NOTIFY_COPY,
  PREF_ROWS,
  type PrefKey,
  normalizeWhatsappInput,
  parsePrefChange,
  whatsappError,
  whatsappUnconfirmed,
} from '~/lib/notifications';

export const meta: MetaFunction = () => [
  { title: `${NOTIFY_COPY.pageTitle} - Rasika.life` },
  { name: 'robots', content: 'noindex, nofollow' },
];

export async function loader({ request }: LoaderFunctionArgs) {
  await requireUser(request);
  const client = await createServerClient(request);
  return data(await client.notify.getPrefs.query());
}

type ActionResult =
  | { ok: true; intent: 'pref' | 'removeWhatsapp' | 'setWhatsapp' }
  | { ok: false; error: string };

export async function action({ request }: ActionFunctionArgs) {
  await requireUser(request);
  const form = await request.formData();
  const intent = form.get('intent');
  const client = await createServerClient(request);

  try {
    if (intent === 'pref') {
      const change = parsePrefChange(form);
      if (!change)
        return data<ActionResult>({ ok: false, error: 'Invalid request' }, { status: 400 });
      await client.notify.setPrefs.mutate(change);
      return data<ActionResult>({ ok: true, intent: 'pref' });
    }
    if (intent === 'removeWhatsapp') {
      await client.notify.removeWhatsapp.mutate();
      return data<ActionResult>({ ok: true, intent: 'removeWhatsapp' });
    }
    if (intent === 'setWhatsapp') {
      const raw = String(form.get('number') ?? '');
      const error = whatsappError(raw, form.get('consent') === 'on');
      const number = normalizeWhatsappInput(raw);
      if (error || !number) {
        return data<ActionResult>({ ok: false, error: error ?? '' }, { status: 400 });
      }
      await client.notify.setWhatsapp.mutate({
        number,
        consent: true,
      });
      return data<ActionResult>({ ok: true, intent: 'setWhatsapp' });
    }
  } catch (error) {
    console.error('Notification settings action failed:', error);
    return data<ActionResult>({ ok: false, error: 'Request failed' }, { status: 500 });
  }
  return data<ActionResult>({ ok: false, error: 'Invalid request' }, { status: 400 });
}

function Toggle({
  prefKey,
  label,
  checked,
}: { prefKey: PrefKey; label: string; checked: boolean }) {
  const fetcher = useFetcher<ActionResult>();
  // Flip at once; the loader's value takes over when the save lands.
  const pending = fetcher.formData?.get('key') === prefKey;
  const on = pending ? fetcher.formData?.get('value') === 'true' : checked;

  useEffect(() => {
    if (fetcher.data?.ok) toast(NOTIFY_COPY.saved);
  }, [fetcher.data]);

  return (
    <fetcher.Form method="post" className="flex items-center justify-between gap-3 py-3">
      <input type="hidden" name="intent" value="pref" />
      <input type="hidden" name="key" value={prefKey} />
      <input type="hidden" name="value" value={String(!on)} />
      <span id={`pref-${prefKey}`}>{label}</span>
      <button
        type="submit"
        role="switch"
        aria-checked={on}
        aria-labelledby={`pref-${prefKey}`}
        className="relative inline-flex h-11 w-14 shrink-0 items-center justify-center md:h-6 md:w-11"
      >
        <span
          aria-hidden="true"
          className={`absolute inset-x-0 top-1/2 h-6 -translate-y-1/2 rounded-full border transition-colors ${
            on ? 'bg-primary border-primary' : 'bg-muted border-input'
          }`}
        />
        <span
          aria-hidden="true"
          className={`absolute top-1/2 h-4 w-4 -translate-y-1/2 rounded-full bg-background shadow transition-all ${
            on ? 'right-2.5 md:right-1.5' : 'left-2.5 md:left-1.5'
          }`}
        />
      </button>
    </fetcher.Form>
  );
}

function WhatsappRow({ whatsapp }: { whatsapp: { number: string; verified: boolean } | null }) {
  const add = useFetcher<ActionResult>();
  const remove = useFetcher<ActionResult>();
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (add.data?.ok) {
      toast(NOTIFY_COPY.whatsappSaved);
      setOpen(false);
    }
  }, [add.data]);

  if (whatsapp) {
    return (
      <div className="flex items-center justify-between gap-3 py-3">
        <span>{whatsapp.verified ? whatsapp.number : whatsappUnconfirmed(whatsapp.number)}</span>
        <remove.Form method="post">
          <input type="hidden" name="intent" value="removeWhatsapp" />
          <Button type="submit" variant="outline" size="sm" className="min-h-11 md:min-h-9">
            {NOTIFY_COPY.whatsappRemove}
          </Button>
        </remove.Form>
      </div>
    );
  }

  const error = add.data && !add.data.ok ? add.data.error : '';
  return (
    <div className="py-3 space-y-3">
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="min-h-11 md:min-h-9"
        aria-expanded={open}
        onClick={() => setOpen(!open)}
      >
        {NOTIFY_COPY.whatsappAdd}
      </Button>
      {open && (
        <add.Form method="post" className="space-y-3">
          <input type="hidden" name="intent" value="setWhatsapp" />
          <h2 className="font-medium">{NOTIFY_COPY.whatsappHeading}</h2>
          <label className="block space-y-1">
            <span className="text-sm">{NOTIFY_COPY.whatsappLabel}</span>
            <span className="flex items-center gap-2">
              <span aria-hidden="true">{NOTIFY_COPY.whatsappPrefix}</span>
              <input
                name="number"
                type="tel"
                inputMode="numeric"
                autoComplete="tel-national"
                placeholder={NOTIFY_COPY.whatsappPlaceholder}
                className="h-11 w-full rounded-md border border-input bg-background px-3"
              />
            </span>
          </label>
          <label className="flex items-start gap-2 text-sm">
            <input type="checkbox" name="consent" className="mt-1 h-4 w-4" />
            <span>{NOTIFY_COPY.whatsappConsent}</span>
          </label>
          {error && (
            <p role="alert" className="text-sm text-destructive">
              {error}
            </p>
          )}
          <Button type="submit" className="min-h-11">
            {NOTIFY_COPY.whatsappSave}
          </Button>
        </add.Form>
      )}
    </div>
  );
}

export default function MeNotifications() {
  const prefs = useLoaderData<typeof loader>();
  return (
    <main className="container mx-auto px-4 py-8 max-w-3xl space-y-6">
      <h1 className="page-title">{NOTIFY_COPY.pageTitle}</h1>
      <div className="divide-y rounded-lg border bg-card px-4">
        {PREF_ROWS.map(row => (
          <Toggle key={row.key} prefKey={row.key} label={row.label} checked={prefs[row.key]} />
        ))}
        {/* TODO(phase 7): the push toggle only records `notifyPush`. Phase 7 asks the browser
            for permission and registers the subscription. */}
        <WhatsappRow whatsapp={prefs.whatsapp} />
      </div>
    </main>
  );
}
