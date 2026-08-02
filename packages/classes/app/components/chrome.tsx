import { AppShell } from '@rasika/ui';
import type { ReactNode } from 'react';
import { Form, Link, useLocation } from 'react-router';

/**
 * The app's frame.
 *
 * The tab bar renders only for someone who teaches, and its "My classes" tab only when they also
 * learn. Most people here are parents with one child and one card; a tab bar with one tab is
 * furniture, and a tab they can never open is worse than none.
 *
 * Both facts come from `getMyContexts`, never from a role — a guru is frequently also a learner,
 * so this is a property of what they have, not of who they are.
 */
export function Chrome({
  title,
  isTeacher,
  isLearner,
  headerRight,
  children,
}: {
  title: ReactNode;
  isTeacher?: boolean;
  isLearner?: boolean;
  headerRight?: ReactNode;
  children: ReactNode;
}) {
  const { pathname } = useLocation();

  return (
    <AppShell
      title={title}
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
      className={`flex min-h-tap flex-1 flex-col items-center justify-center px-2 py-2 text-xs font-medium ${
        active ? 'text-primary' : 'text-muted-foreground'
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
