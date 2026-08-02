import * as React from 'react';
import { cn } from '../cn';
import { Button } from './button';

/**
 * A native `<dialog>`, not a portal-and-focus-trap of our own.
 *
 * The platform element already does the modal focus trap, the inert background, Escape to
 * close, and the top layer — all the parts that are easy to get subtly wrong and that a screen
 * reader user notices immediately. It costs no dependency and behaves correctly in the
 * installed PWA, which is where this app mostly runs.
 *
 * The one thing it does not do is close on a backdrop click, so that is wired here.
 */
export function Dialog({
  open,
  onClose,
  title,
  description,
  children,
  footer,
  className,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  children?: React.ReactNode;
  footer?: React.ReactNode;
  className?: string;
}) {
  const ref = React.useRef<HTMLDialogElement>(null);

  React.useEffect(() => {
    const element = ref.current;
    if (!element) {
      return;
    }
    if (open && !element.open) {
      element.showModal();
    } else if (!open && element.open) {
      element.close();
    }
  }, [open]);

  return (
    // The keyboard equivalent already exists and is the platform's: a native modal `<dialog>`
    // closes on Escape by itself and reports it through `onClose` below. The click handler only
    // adds backdrop-dismiss, which has no keyboard counterpart to add, because a keyboard user
    // cannot reach the backdrop.
    // biome-ignore lint/a11y/useKeyWithClickEvents: Escape is handled natively, see above
    <dialog
      ref={ref}
      // Fires on Escape as well as on `close()`, so this is the single place the parent's state
      // gets told the dialog is shut. Without it, Escape closes the element and leaves `open`
      // true, and the dialog can never be reopened.
      onClose={onClose}
      onClick={event => {
        // A click lands on the dialog element itself only when it hit the backdrop; anything
        // inside targets a child.
        if (event.target === ref.current) {
          onClose();
        }
      }}
      className={cn(
        'w-[calc(100vw-2rem)] max-w-md rounded-lg border border-border bg-card p-0 text-card-foreground backdrop:bg-black/50',
        className
      )}
      aria-labelledby="dialog-title"
    >
      <div className="p-4">
        <h2 id="dialog-title" className="text-lg font-semibold">
          {title}
        </h2>
        {description ? <p className="mt-1 text-sm text-muted-foreground">{description}</p> : null}
        <div className="mt-4">{children}</div>
        <div className="mt-6 flex justify-end gap-2">
          {/*
            `undefined`, not nullish. `footer ?? default` meant a caller passing an explicit
            `null` to say "I have my own buttons" got the default anyway — the add-class dialog
            rendered Cancel, Add class *and* a stray Close that did the same thing as Cancel.
          */}
          {footer === undefined ? (
            <Button type="button" variant="outline" onClick={onClose}>
              Close
            </Button>
          ) : (
            footer
          )}
        </div>
      </div>
    </dialog>
  );
}
