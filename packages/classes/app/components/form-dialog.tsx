import { Button, Dialog } from '@rasika/ui';
import type { ReactNode } from 'react';
import { useState } from 'react';

/**
 * A form in a modal, which becomes a form on the page when there is no JavaScript.
 *
 * These were `<details>` disclosures. On a phone that is the wrong shape for a form: expanding one
 * pushes everything below it down, so the guru taps "Add a student", the page jumps, and the
 * fields she wants are wherever the reflow left them. A modal takes the screen, which is what
 * filling in a form actually is.
 *
 * ## The form is rendered once
 *
 * The obvious way to keep this working without JavaScript is a `<noscript>` copy of the form
 * beside the dialog — and that means every field's `id` exists twice, so every `<label for>` binds
 * to whichever the parser saw first. Half the labels in the fallback would point at the modal's
 * hidden inputs.
 *
 * So there is one form, inside one `<dialog>`, and a `<noscript>` stylesheet in the root document
 * changes what a `<dialog>` *is*: closed, it is `display: none` by default and the trigger opens
 * it; with the fallback rules active it is a static block and the trigger hides itself. Confirmed
 * in a browser both ways.
 */
export function FormDialog({
  trigger,
  triggerVariant = 'outline',
  title,
  description,
  children,
  className,
}: {
  trigger: ReactNode;
  triggerVariant?: 'primary' | 'outline' | 'ghost';
  title: string;
  description?: string;
  children: ReactNode;
  className?: string;
}) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <Button
        type="button"
        variant={triggerVariant}
        className={`js-only ${className ?? ''}`}
        onClick={() => setOpen(true)}
      >
        {trigger}
      </Button>

      <Dialog
        open={open}
        onClose={() => setOpen(false)}
        title={title}
        description={description}
        // `null`, not omitted: the actions belong to the form inside, and `Dialog` renders its
        // default Close button only when the prop is absent.
        footer={null}
        className="form-dialog"
      >
        {/*
          React's synthetic submit bubbles, so one handler here closes the dialog whichever form
          inside it was submitted. Without this the action redirects, the route re-renders with
          the component still mounted, and `open` stays true over the top of the new page.
        */}
        <div onSubmit={() => setOpen(false)}>{children}</div>
      </Dialog>
    </>
  );
}
