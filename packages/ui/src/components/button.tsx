import { type VariantProps, cva } from 'class-variance-authority';
import * as React from 'react';
import { cn } from '../cn';

/**
 * Every size here clears 44px.
 *
 * This is a phone-first app used one-handed, often standing up in a class. `packages/web`'s
 * `sm` button is 36px and stays that way — changing a primitive the whole wiki uses is its own
 * decision — but nothing here inherits that compromise.
 */
const buttonVariants = cva(
  'inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:pointer-events-none disabled:opacity-50',
  {
    variants: {
      variant: {
        primary: 'bg-primary text-primary-foreground hover:bg-primary/90',
        secondary: 'bg-secondary text-secondary-foreground hover:bg-secondary/80',
        outline: 'border border-border bg-transparent hover:bg-accent hover:text-accent-foreground',
        ghost: 'hover:bg-accent hover:text-accent-foreground',
        destructive: 'bg-destructive text-destructive-foreground hover:bg-destructive/90',
      },
      size: {
        default: 'h-tap px-4 py-2',
        wide: 'h-tap w-full px-4 py-2',
        icon: 'h-tap w-tap',
      },
    },
    defaultVariants: { variant: 'primary', size: 'default' },
  }
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  /** Replaces the label while a submission is in flight, and disables the control. */
  pending?: boolean;
  pendingLabel?: string;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { className, variant, size, pending, pendingLabel, children, disabled, ...props },
  ref
) {
  return (
    <button
      ref={ref}
      className={cn(buttonVariants({ variant, size }), className)}
      disabled={disabled || pending}
      // The label change alone is silent to a screen reader mid-page; `aria-busy` is what says
      // the control is working rather than broken.
      aria-busy={pending || undefined}
      {...props}
    >
      {pending ? (pendingLabel ?? children) : children}
    </button>
  );
});

export { buttonVariants };
