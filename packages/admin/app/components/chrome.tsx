import type { ReactNode } from 'react';
import { Form, Link } from 'react-router';
import { ADMIN_COPY, ADMIN_EXTRA_COPY } from '~/lib/copy';

/** Keyboard focus ring on `ring`, for `:focus-visible` only: a mouse click leaves no box. */
const FOCUS =
  'rounded-sm outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background';

/** Header and a wide content column. This is a desk tool, so it is not the phone shell. */
export function Chrome({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-[100dvh] flex-col bg-background text-foreground">
      <header className="border-b border-border">
        <div className="mx-auto flex h-14 w-full max-w-5xl items-center gap-6 px-4">
          <Link to="/qr" className={`font-semibold no-underline ${FOCUS}`}>
            {ADMIN_EXTRA_COPY.brand}
          </Link>
          <nav aria-label="Main" className="flex flex-1 items-center gap-4 text-sm">
            <Link to="/qr" className={`text-muted-foreground hover:text-foreground ${FOCUS}`}>
              {ADMIN_COPY.batches.title}
            </Link>
            <Link to="/sabhas" className={`text-muted-foreground hover:text-foreground ${FOCUS}`}>
              {ADMIN_EXTRA_COPY.partners}
            </Link>
            <Link
              to="/events/spot-check"
              className={`text-muted-foreground hover:text-foreground ${FOCUS}`}
            >
              {ADMIN_EXTRA_COPY.spotCheck}
            </Link>
          </nav>
          <Form method="post" action="/auth/logout">
            <button
              type="submit"
              className={`min-h-tap px-2 text-sm text-muted-foreground underline ${FOCUS}`}
            >
              {ADMIN_EXTRA_COPY.signOut}
            </button>
          </Form>
        </div>
      </header>
      <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-6">{children}</main>
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
