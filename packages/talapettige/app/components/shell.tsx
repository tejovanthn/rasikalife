import { AppShell, cn, navItemClasses } from '@rasika/ui';
import { History, Info, Music } from 'lucide-react';
import type * as React from 'react';
import { Link, useLocation } from 'react-router';

const NAV = [
  { to: '/', label: 'Practice', icon: Music },
  { to: '/history', label: 'History', icon: History },
  { to: '/about', label: 'About', icon: Info },
] as const;

/**
 * Rasika Classes' shell, with client-side links. `NavItem` is a plain `<a>`, which would reload
 * the page on every tap; `Link` with the same classes keeps the app a single page.
 */
export function TalapettigeShell({ children }: { children: React.ReactNode }) {
  const { pathname } = useLocation();

  return (
    <AppShell
      brand={
        <Link to="/" className="flex items-baseline gap-2">
          <span>Talapettige</span>
          <span lang="kn" className="font-normal text-muted-foreground text-sm">
            ತಾಳಪೆಟ್ಟಿಗೆ
          </span>
        </Link>
      }
      nav={NAV.map(({ to, label, icon: Icon }) => {
        const active = to === '/' ? pathname === '/' : pathname.startsWith(to);
        return (
          <Link
            key={to}
            to={to}
            aria-current={active ? 'page' : undefined}
            className={cn(
              navItemClasses,
              active ? 'text-primary' : 'text-muted-foreground hover:text-foreground'
            )}
          >
            <Icon className="h-5 w-5 md:h-4 md:w-4" aria-hidden />
            {label}
          </Link>
        );
      })}
    >
      {children}
    </AppShell>
  );
}
