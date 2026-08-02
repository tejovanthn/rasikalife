import * as React from 'react';
import { cn } from '../cn';

const controlClasses =
  'flex h-tap w-full rounded-md border border-border bg-background px-3 py-2 text-base text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:cursor-not-allowed disabled:opacity-50';

/**
 * `text-base`, not `text-sm`.
 *
 * iOS Safari zooms the whole page when a text input smaller than 16px takes focus, and it does
 * not zoom back out. On a form the guru fills in during a class that is the difference between
 * usable and not.
 */
export const Input = React.forwardRef<
  HTMLInputElement,
  React.InputHTMLAttributes<HTMLInputElement>
>(function Input({ className, ...props }, ref) {
  return <input ref={ref} className={cn(controlClasses, className)} {...props} />;
});

export const Textarea = React.forwardRef<
  HTMLTextAreaElement,
  React.TextareaHTMLAttributes<HTMLTextAreaElement>
>(function Textarea({ className, ...props }, ref) {
  return (
    <textarea ref={ref} className={cn(controlClasses, 'h-auto min-h-24', className)} {...props} />
  );
});

export const Select = React.forwardRef<
  HTMLSelectElement,
  React.SelectHTMLAttributes<HTMLSelectElement>
>(function Select({ className, children, ...props }, ref) {
  return (
    // A native select rather than a listbox built out of divs: it gets the platform picker on a
    // phone, which is faster to use one-handed than anything worth building here.
    <select ref={ref} className={cn(controlClasses, 'appearance-none pr-8', className)} {...props}>
      {children}
    </select>
  );
});

export function Label({ className, ...props }: React.LabelHTMLAttributes<HTMLLabelElement>) {
  return (
    // A pass-through wrapper: the association is made by the caller's `htmlFor`, which the rule
    // cannot see from here. `Field` below always supplies one, and `fieldAria` gives the control
    // the matching id.
    // biome-ignore lint/a11y/noLabelWithoutControl: association is the caller's, see above
    <label className={cn('block text-sm font-medium text-foreground', className)} {...props} />
  );
}

/**
 * Label, control and error as one unit.
 *
 * The error is wired with `aria-describedby` and rendered in `--destructive`, which is a
 * different value in each theme precisely so it stays readable — a single value gave 2.19:1 on
 * dark, which is close to invisible.
 */
export function Field({
  label,
  htmlFor,
  error,
  hint,
  children,
  className,
}: {
  label: string;
  htmlFor: string;
  error?: string | null;
  hint?: string;
  children: React.ReactNode;
  className?: string;
}) {
  const hintId = hint ? `${htmlFor}-hint` : undefined;
  const errorId = error ? `${htmlFor}-error` : undefined;

  return (
    <div className={cn('space-y-1.5', className)}>
      <Label htmlFor={htmlFor}>{label}</Label>
      {hint ? (
        <p id={hintId} className="text-sm text-muted-foreground">
          {hint}
        </p>
      ) : null}
      {children}
      {error ? (
        <p id={errorId} className="text-sm text-destructive" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}

/** The ids a `Field`'s control should point at, so the wiring cannot drift from the markup. */
export function fieldAria(name: string, options: { error?: string | null; hint?: string }) {
  const described = [options.hint ? `${name}-hint` : null, options.error ? `${name}-error` : null]
    .filter(Boolean)
    .join(' ');
  return {
    id: name,
    name,
    'aria-invalid': options.error ? true : undefined,
    'aria-describedby': described || undefined,
  };
}
