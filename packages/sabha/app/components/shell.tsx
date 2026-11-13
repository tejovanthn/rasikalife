import type { ReactNode } from 'react';
import { Form, Link, useRouteLoaderData, useSubmit } from 'react-router';
import { SABHA_COPY, SABHA_EXTRA_COPY } from '~/lib/copy';
import type { Tab } from '~/lib/sabha';

/**
 * A keyboard focus ring on `ring`, drawn only for `:focus-visible`. A mouse click on a link or
 * tab leaves no box behind. The base layer in `globals.css` does the same for everything else.
 */
const FOCUS =
  'rounded-sm outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background';

export type SwitcherOption = { targetType: string; targetId: string; targetName: string };

/**
 * The header's "Managing" switcher: a select of the dashboards this person can open. It is a GET
 * form to `/switch`, so it works without JavaScript (the button is there for that case);
 * with JavaScript, picking one submits at once. One dashboard needs no switcher.
 */
function Switcher({
  options,
  current,
}: {
  options: SwitcherOption[];
  current?: { targetType: string; targetId: string };
}) {
  const submit = useSubmit();
  if (options.length < 2) return null;
  const value = current ? `${current.targetType}:${current.targetId}` : '';
  return (
    <Form method="get" action="/switch" className="flex items-center gap-2 text-sm">
      <label htmlFor="switcher" className="text-muted-foreground">
        {SABHA_COPY.switcherLabel}
      </label>
      <select
        id="switcher"
        name="to"
        defaultValue={value}
        onChange={event => submit(event.currentTarget.form)}
        className={`h-tap max-w-[14rem] rounded-md border border-border bg-background px-2 ${FOCUS}`}
      >
        {options.map(option => (
          <option
            key={`${option.targetType}:${option.targetId}`}
            value={`${option.targetType}:${option.targetId}`}
          >
            {option.targetName}
          </option>
        ))}
      </select>
      <noscript>
        <button type="submit" className={`min-h-tap px-2 underline ${FOCUS}`}>
          {SABHA_EXTRA_COPY.inviteOpen}
        </button>
      </noscript>
    </Form>
  );
}

/** "Invites (2)" for the signed-in person's own pending invites. Hidden at zero. */
function InvitesLink() {
  const root = useRouteLoaderData('root') as { pendingInvites?: number } | undefined;
  const count = root?.pendingInvites ?? 0;
  if (count < 1) return null;
  return (
    <Link
      to="/invite"
      className={`inline-flex min-h-tap items-center px-2 text-sm font-medium text-primary underline ${FOCUS}`}
    >
      {SABHA_EXTRA_COPY.invitesLink(count)}
    </Link>
  );
}

/** A header, optional dashboard tabs, and a content column. */
export function Shell({
  children,
  switcher,
  current,
  tabs,
  activeTab,
}: {
  children: ReactNode;
  switcher?: SwitcherOption[];
  current?: { targetType: string; targetId: string };
  tabs?: Tab[];
  activeTab?: string;
}) {
  return (
    <div className="flex min-h-[100dvh] flex-col bg-background text-foreground">
      <header className="border-b border-border">
        <div className="mx-auto flex min-h-14 w-full max-w-4xl flex-wrap items-center gap-x-6 gap-y-2 px-4 py-2">
          <Link to="/" className={`font-semibold no-underline ${FOCUS}`}>
            {SABHA_EXTRA_COPY.brand}
          </Link>
          <div className="flex-1">
            <Switcher options={switcher ?? []} current={current} />
          </div>
          <InvitesLink />
          <Form method="post" action="/auth/logout">
            <button
              type="submit"
              className={`min-h-tap px-2 text-sm text-muted-foreground underline ${FOCUS}`}
            >
              {SABHA_EXTRA_COPY.signOut}
            </button>
          </Form>
        </div>
        {tabs ? (
          <nav aria-label="Dashboard" className="mx-auto w-full max-w-4xl overflow-x-auto px-4">
            <ul className="flex gap-1">
              {tabs.map(tab => (
                <li key={tab.key}>
                  <Link
                    to={tab.path}
                    aria-current={tab.key === activeTab ? 'page' : undefined}
                    className={
                      tab.key === activeTab
                        ? `inline-flex min-h-tap items-center whitespace-nowrap border-b-2 border-primary px-3 text-sm font-medium ${FOCUS}`
                        : `inline-flex min-h-tap items-center whitespace-nowrap border-b-2 border-transparent px-3 text-sm text-muted-foreground hover:text-foreground ${FOCUS}`
                    }
                  >
                    {tab.label}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
        ) : null}
      </header>
      <main className="mx-auto w-full max-w-4xl flex-1 px-4 py-6">{children}</main>
    </div>
  );
}

/** A plain error line under a form. */
export function FormError({ children }: { children?: ReactNode }) {
  if (!children) return null;
  return (
    <p role="alert" className="text-sm text-destructive">
      {children}
    </p>
  );
}

/** One number with its label, for the Overview and Followers screens. */
export function Stat({ label, value }: { label: string; value: number | string }) {
  return (
    // The term comes first in the markup, and `flex-col-reverse` shows the number above it.
    <div className="flex flex-col-reverse rounded-lg border border-border bg-card p-4">
      <dt className="mt-1 text-sm text-muted-foreground">{label}</dt>
      <dd className="text-3xl font-semibold tabular-nums">{value}</dd>
    </div>
  );
}
