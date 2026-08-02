import { AppShell, navItemClasses } from '@rasika/ui';
import type { ReactNode } from 'react';
import { Form, Link, useLocation } from 'react-router';

/**
 * The app's frame.
 *
 * The nav renders only for someone who teaches, and its "My classes" entry only when they also
 * learn. Most people here are parents with one child and one card; navigation with one
 * destination is furniture, and a destination they can never open is worse than none.
 *
 * Both facts come from `getMyContexts`, never from a role — a guru is frequently also a learner,
 * so this is a property of what they have, not of who they are.
 *
 * Where the nav *sits* is `AppShell`'s business: a bottom tab bar on a phone, the header on a
 * desktop. Nothing here needs to know which.
 */
export function Chrome({
  isTeacher,
  isLearner,
  headerRight,
  children,
}: {
  isTeacher?: boolean;
  isLearner?: boolean;
  headerRight?: ReactNode;
  children: ReactNode;
}) {
  const { pathname } = useLocation();

  return (
    <AppShell
      brand={
        // Home is the resolver, which knows where this person belongs better than a fixed link
        // would — a guru who also learns lands wherever she was last.
        <Link to="/" className="no-underline">
          Classes
        </Link>
      }
      headerRight={headerRight}
      nav={
        isTeacher ? (
          <>
            {isLearner ? (
              <NavLink to="/home" label="My classes" active={pathname.startsWith('/home')} />
            ) : null}
            <NavLink to="/teaching" label="Students" active={pathname.startsWith('/teaching')} />
            <NavLink to="/review" label="Review" active={pathname.startsWith('/review')} />
          </>
        ) : null
      }
    >
      {children}
    </AppShell>
  );
}

function NavLink({ to, label, active }: { to: string; label: string; active: boolean }) {
  return (
    <Link
      to={to}
      aria-current={active ? 'page' : undefined}
      className={`${navItemClasses} ${
        active ? 'text-primary' : 'text-muted-foreground hover:text-foreground'
      }`}
    >
      {label}
    </Link>
  );
}

export function SignOutButton() {
  return (
    <Form method="post" action="/auth/logout">
      <button type="submit" className="min-h-tap px-2 text-sm text-muted-foreground underline">
        Sign out
      </button>
    </Form>
  );
}
