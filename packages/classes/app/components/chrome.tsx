import { AppShell } from '@rasika/ui';
import type { ReactNode } from 'react';
import { Form, Link, useLocation } from 'react-router';

/**
 * The app's frame.
 *
 * The tab bar renders **only** when the signed-in user actually teaches. Most people here are
 * parents with one child and one card, and a "Students" tab they can never open is worse than
 * no tab bar at all. `isTeacher` comes from whether they own an institution, not from a role.
 */
export function Chrome({
  title,
  isTeacher,
  headerRight,
  children,
}: {
  title: ReactNode;
  isTeacher?: boolean;
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
            <NavLink to="/" label="My classes" active={pathname === '/'} />
            <NavLink to="/students" label="Students" active={pathname.startsWith('/students')} />
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
