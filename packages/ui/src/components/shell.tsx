import type * as React from 'react';
import { cn } from '../cn';

/**
 * The app shell: a header, a scrolling body, and navigation that changes place with the viewport.
 *
 * **Below `md` the nav is a bottom tab bar**, because that is an installed phone app held in one
 * hand and the thumb does not reach the top of the screen. The safe-area insets matter for the
 * same reason — in standalone mode there is no browser chrome, so without them the bar sits
 * underneath the home indicator.
 *
 * **At `md` and above it moves into the header.** A bar pinned to the bottom of a 1200px window
 * is not a phone convention applied kindly, it is a phone convention applied to something that is
 * not a phone: it sits miles from the content, and on a tall window it floats alone at the foot
 * of an empty page.
 *
 * The `nav` node is rendered into both slots and each is hidden at the other breakpoint. That is
 * two copies in the DOM and one in the accessibility tree, because `display: none` is not
 * exposed — so there is no duplicate landmark and no duplicate `aria-current`. `NavItem` styles
 * itself for both placements in one class list, which works precisely because only one container
 * is ever visible.
 *
 * The header carries the **product** name, not the page's. Every screen already opens with an
 * `<h1>`, so a page title here was saying the same word twice — three times once the nav arrived,
 * since the active tab says it too.
 */
export function AppShell({
  brand,
  headerRight,
  nav,
  children,
}: {
  brand: React.ReactNode;
  headerRight?: React.ReactNode;
  nav?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-[100dvh] flex-col bg-background text-foreground">
      <header className="sticky top-0 z-30 border-b border-border bg-background/95 pt-[env(safe-area-inset-top)] backdrop-blur">
        <div className="mx-auto flex h-14 w-full max-w-2xl items-center gap-3 px-4">
          <div className="shrink-0 font-semibold">{brand}</div>

          {nav ? (
            <nav aria-label="Main" className="hidden min-w-0 flex-1 items-stretch md:flex">
              {nav}
            </nav>
          ) : null}

          {/* `ml-auto` only while the desktop nav is absent, or it would fight the nav's flex-1. */}
          <div className={cn('shrink-0', nav ? 'ml-auto md:ml-0' : 'ml-auto')}>{headerRight}</div>
        </div>
      </header>

      {/* A skip link would be noise below `md`, where the header holds one or two controls. At
          `md` the nav is in the header and sits between the brand and the main region, which is
          still only a few tab stops. */}
      <main className="mx-auto w-full max-w-2xl flex-1 px-4 py-4">{children}</main>

      {nav ? (
        <nav
          aria-label="Main"
          className="sticky bottom-0 z-30 border-t border-border bg-background/95 pb-[env(safe-area-inset-bottom)] backdrop-blur md:hidden"
        >
          <div className="mx-auto flex w-full max-w-2xl items-stretch">{nav}</div>
        </nav>
      ) : null}
    </div>
  );
}

/**
 * One class list for both placements.
 *
 * Below `md` it is a tab: equal width, stacked, small. At `md` it is a header link: intrinsic
 * width, inline, ordinary text size. Only one container is visible at a time, so a single
 * responsive string describes both without either knowing about the other.
 */
export const navItemClasses =
  // The focus ring is explicit rather than left to the UA default, so a keyboard user sees the
  // same indicator here as on every button and field. `--ring` tracks `--primary` and clears the
  // 3:1 that 1.4.11 asks of a non-text indicator.
  'flex min-h-tap flex-1 flex-col items-center justify-center gap-0.5 rounded-md px-2 py-2 text-xs font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background md:min-h-0 md:flex-none md:flex-row md:px-3 md:text-sm';

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
        navItemClasses,
        active ? 'text-primary' : 'text-muted-foreground hover:text-foreground',
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
