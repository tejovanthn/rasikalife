import type * as React from 'react';
import { cn } from '../cn';

/**
 * The app shell: a header, a scrolling body, and a bottom tab bar.
 *
 * Bottom navigation rather than a top menu, because this is an installed phone app held in one
 * hand. The safe-area insets matter for the same reason — in standalone mode there is no browser
 * chrome, so the tab bar sits directly on the home indicator without them.
 */
export function AppShell({
  title,
  headerRight,
  nav,
  children,
}: {
  title: React.ReactNode;
  headerRight?: React.ReactNode;
  nav?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-[100dvh] flex-col bg-background text-foreground">
      <header className="sticky top-0 z-30 border-b border-border bg-background/95 pt-[env(safe-area-inset-top)] backdrop-blur">
        <div className="mx-auto flex h-14 w-full max-w-2xl items-center justify-between gap-2 px-4">
          <div className="min-w-0 flex-1 truncate font-semibold">{title}</div>
          {headerRight}
        </div>
      </header>

      {/* A skip link would be noise here — the header holds one control, so the main region is
          two tab stops away regardless. */}
      <main className="mx-auto w-full max-w-2xl flex-1 px-4 py-4">{children}</main>

      {nav ? (
        <nav className="sticky bottom-0 z-30 border-t border-border bg-background/95 pb-[env(safe-area-inset-bottom)] backdrop-blur">
          <div className="mx-auto flex w-full max-w-2xl items-stretch">{nav}</div>
        </nav>
      ) : null}
    </div>
  );
}

export function NavItem({
  active,
  className,
  children,
  ...props
}: React.AnchorHTMLAttributes<HTMLAnchorElement> & { active?: boolean }) {
  return (
    <a
      aria-current={active ? 'page' : undefined}
      className={cn(
        'flex min-h-tap flex-1 flex-col items-center justify-center gap-0.5 px-2 py-2 text-xs font-medium',
        active ? 'text-primary' : 'text-muted-foreground',
        className
      )}
      {...props}
    >
      {children}
    </a>
  );
}

export function PageTitle({ className, ...props }: React.HTMLAttributes<HTMLHeadingElement>) {
  return <h1 className={cn('text-2xl font-bold tracking-tight', className)} {...props} />;
}

export function SectionTitle({ className, ...props }: React.HTMLAttributes<HTMLHeadingElement>) {
  return <h2 className={cn('text-base font-semibold tracking-tight', className)} {...props} />;
}
