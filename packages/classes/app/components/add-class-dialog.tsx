import { Button, Dialog, Field, Input, Textarea } from '@rasika/ui';
import { useState } from 'react';
import { Form, useNavigation } from 'react-router';

/**
 * "I attended today" — with the date editable, because it is not always today.
 *
 * `markAttended` used to compute the date server-side and refuse a client one outright, on the
 * reasoning that taking it from the browser lets somebody fabricate history. Half right: the
 * *future* is fabrication and is still refused, and so is anything over a month old. But "I
 * forgot to mark Tuesday" is the ordinary case, and refusing it left the student's only honest
 * option being to mark the wrong day — which corrupts the ledger in the name of protecting it.
 *
 * What makes the past safe is the thing that was always there: the row lands `pending` and the
 * guru sees it in her review queue with the date on it. She is the one who decides a class
 * happened; this only decides what she is asked about.
 *
 * The date starts collapsed behind "Change" so the common case stays one tap.
 */
export function AddClassDialog({
  programId,
  learnerId,
  programTitle,
  today,
  earliest,
}: {
  programId: string;
  learnerId: string;
  programTitle: string;
  today: string;
  earliest: string;
}) {
  const [open, setOpen] = useState(false);
  const [editingDate, setEditingDate] = useState(false);
  const navigation = useNavigation();
  const pending = navigation.state === 'submitting';

  return (
    <>
      <Button type="button" onClick={() => setOpen(true)}>
        I attended today
      </Button>

      <Dialog
        open={open}
        onClose={() => setOpen(false)}
        title="Add a class"
        description={programTitle}
        footer={null}
      >
        <Form method="post" className="space-y-4" onSubmit={() => setOpen(false)}>
          <input type="hidden" name="intent" value="mark-attended" />
          <input type="hidden" name="programId" value={programId} />
          <input type="hidden" name="learnerId" value={learnerId} />

          {editingDate ? (
            <Field
              label="Date"
              htmlFor="sessionDate"
              hint="The day the class happened, on your teacher's calendar."
            >
              <Input
                id="sessionDate"
                name="sessionDate"
                type="date"
                defaultValue={today}
                // The browser enforces the same bounds the server does, so the common mistake is
                // caught before a round trip rather than after one.
                min={earliest}
                max={today}
              />
            </Field>
          ) : (
            <div className="flex items-center justify-between gap-3">
              <span className="text-sm">
                <span className="text-muted-foreground">Date: </span>
                {today}
              </span>
              <Button type="button" variant="ghost" onClick={() => setEditingDate(true)}>
                Change
              </Button>
            </div>
          )}

          <Field label="Notes" htmlFor="notes" hint="Optional. Your teacher sees this.">
            <Textarea id="notes" name="notes" rows={3} />
          </Field>

          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" pending={pending} pendingLabel="Adding…">
              Add class
            </Button>
          </div>
        </Form>
      </Dialog>
    </>
  );
}
