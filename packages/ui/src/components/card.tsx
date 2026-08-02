import type * as React from 'react';
import { cn } from '../cn';

export function Card({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn('rounded-lg border border-border bg-card text-card-foreground', className)}
      {...props}
    />
  );
}

export function CardHeader({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('flex flex-col gap-1 p-4', className)} {...props} />;
}

/**
 * The level is the caller's to choose, because only the caller knows what encloses the card.
 *
 * It was always `<h2>`, which is right on a page whose cards sit directly under the `<h1>` and
 * wrong on one where they sit inside a `<SectionTitle>` — there a screen reader heard h1 →
 * h2 "Classes" → h2 "Sun 2 Aug", so the sessions read as siblings of the section containing
 * them and heading navigation stopped describing the page.
 *
 * `h2` stays the default: it is correct for the majority of screens here, and a wrong default
 * that flattens is less harmful than one that skips a level. `as="span"` is for the cards whose
 * title sits inside a `<label>`, where a heading is not permitted content.
 */
export function CardTitle({
  as: Tag = 'h2',
  className,
  ...props
}: React.HTMLAttributes<HTMLHeadingElement> & { as?: 'h2' | 'h3' | 'span' }) {
  return <Tag className={cn('text-lg font-semibold leading-tight', className)} {...props} />;
}

export function CardDescription({
  className,
  ...props
}: React.HTMLAttributes<HTMLParagraphElement>) {
  return <p className={cn('text-sm text-muted-foreground', className)} {...props} />;
}

export function CardContent({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('p-4 pt-0', className)} {...props} />;
}

export function CardFooter({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('flex items-center gap-2 p-4 pt-0', className)} {...props} />;
}

/**
 * Solid fills, paired with the foreground each token was designed against.
 *
 * These were tints — `bg-primary/15 text-primary` and friends — and every one of them was a
 * colour nothing could check. `contrast.test.ts` asserts *solid* token pairs, so an alpha
 * composite over a surface slipped through the one test built to catch exactly this. Measured
 * afterwards: the primary badge read **3.46:1** in light mode at `text-xs`, and the success and
 * warning badges read **1.31:1** and **1.50:1** in dark, because `--success-foreground` and
 * `--warning-foreground` are near-black in *both* themes — they exist for a solid fill, and at
 * 20% alpha over a near-black card that assumption inverts.
 *
 * A tint needs a foreground that flips with the theme, and there is no such token; inventing one
 * per tone is three more values to keep in step for a status pill. Solid uses the pairs the
 * tokens were computed for and already tested as, and a badge earning attention is its job.
 *
 * `badge-contrast.test.ts` in packages/web now parses this map and asserts every pair in both
 * themes — including compositing the alpha back over both surfaces if anyone reintroduces one.
 */
const badgeTones = {
  neutral: 'bg-muted text-muted-foreground',
  primary: 'bg-primary text-primary-foreground',
  success: 'bg-success text-success-foreground',
  warning: 'bg-warning text-warning-foreground',
  destructive: 'bg-destructive text-destructive-foreground',
} as const;

export type BadgeTone = keyof typeof badgeTones;

export function Badge({
  tone = 'neutral',
  className,
  ...props
}: React.HTMLAttributes<HTMLSpanElement> & { tone?: BadgeTone }) {
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium',
        badgeTones[tone],
        className
      )}
      {...props}
    />
  );
}

/**
 * What a section shows when it has nothing.
 *
 * A bare heading over emptiness reads as a page that failed to load. This says what would go
 * here and, where there is one, offers the action that would put something in it.
 */
export function EmptyState({
  title,
  children,
  action,
}: {
  title: string;
  children?: React.ReactNode;
  action?: React.ReactNode;
}) {
  return (
    <div className="rounded-lg border border-dashed border-border p-6 text-center">
      <p className="font-medium text-foreground">{title}</p>
      {children ? <p className="mt-1 text-sm text-muted-foreground">{children}</p> : null}
      {action ? <div className="mt-4 flex justify-center">{action}</div> : null}
    </div>
  );
}
