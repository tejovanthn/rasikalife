import type { ReactNode } from 'react';
import { Link } from 'react-router';
import { buttonVariants } from '~/components/ui/button';
import { cn } from '~/lib/utils';

/**
 * A filter or sort that is a link, so the page works without JavaScript and every view has its
 * own URL. A button rather than a chip: in this system a chip labels a thing and never toggles
 * (DESIGN.md). 44px tall on a phone.
 *
 * `aria-current="true"` marks the chosen item within its own set. Not `"page"`: a listing has
 * several sets on screen at once (date, view), and only one thing on a page can be the page.
 */
export function FilterLink({
  to,
  active,
  children,
  label,
  className,
}: {
  to: string;
  active: boolean;
  children: ReactNode;
  /** For a screen reader, when the visible text is abbreviated. */
  label?: string;
  className?: string;
}) {
  return (
    <Link
      to={to}
      preventScrollReset
      aria-label={label}
      aria-current={active ? 'true' : undefined}
      className={cn(
        buttonVariants({ variant: active ? 'secondary' : 'outline', size: 'sm' }),
        'min-h-11 md:min-h-9 no-underline',
        active && 'font-semibold',
        className
      )}
    >
      {children}
    </Link>
  );
}
