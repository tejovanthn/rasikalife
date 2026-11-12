import { QR_BULK_ASSIGN_MAX } from '@rasika/core/domain/venue-qr/client';
import { Button, Field, Input, PageTitle, buttonVariants } from '@rasika/ui';
import { useState } from 'react';
import type { ActionFunctionArgs, LoaderFunctionArgs } from 'react-router';
import { Form, Link, data, useActionData, useLoaderData, useNavigation } from 'react-router';
import { Chrome, FormError } from '~/components/chrome';
import { VenuePicker } from '~/components/venue-picker';
import { createServerClient, errorMessage, loadVenueOptions, siteUrl } from '~/lib/api.server';
import { requireModerator } from '~/lib/auth.server';
import { ADMIN_COPY, ADMIN_EXTRA_COPY } from '~/lib/copy';
import { pageMeta } from '~/lib/meta';
import { assignItems, fillLabels, readAssignRows } from '~/lib/qr-admin';
import type { AssignRow } from '~/lib/qr-admin';

export const meta = () => pageMeta(ADMIN_COPY.assign.submit);

/** Unassigned codes of one batch, in the order the batch page shows them. */
async function unassignedCodes(request: Request, batchId: string): Promise<string[]> {
  const trpc = await createServerClient(request);
  const { codes } = await trpc.qr.getBatch.query({ batchId });
  return codes.filter(code => code.status === 'unassigned').map(code => code.code);
}

export async function loader({ request, params }: LoaderFunctionArgs) {
  await requireModerator(request);
  const batchId = params.id ?? '';
  const trpc = await createServerClient(request);
  const [codes, venues] = await Promise.all([
    unassignedCodes(request, batchId),
    loadVenueOptions(trpc),
  ]);
  return { batchId, codes, venues, createVenueUrl: `${siteUrl()}/venues/new` };
}

export async function action({ request, params }: ActionFunctionArgs) {
  await requireModerator(request);
  const batchId = params.id ?? '';
  const form = await request.formData();
  const venueId = String(form.get('venueId') ?? '');
  const spaceId = String(form.get('spaceId') ?? '');

  const pageOrder = await unassignedCodes(request, batchId);
  let rows = readAssignRows(form, pageOrder);
  const base = { count: 0, venueId, rows, missing: [] as string[] };

  // The no-JavaScript path of the "Fill labels" button: send the form back with labels filled.
  if (form.get('intent') === 'fill') {
    rows = fillLabels(rows, String(form.get('fillText') ?? ''));
    return data({ ...base, rows, error: null, filled: true });
  }

  const { items, missing, ticked } = assignItems(rows, QR_BULK_ASSIGN_MAX);
  if (ticked === 0) {
    return data({ ...base, error: ADMIN_EXTRA_COPY.bulkNone }, { status: 400 });
  }
  if (!venueId) return data({ ...base, error: ADMIN_COPY.assign.venue }, { status: 400 });
  if (missing.length > 0) {
    return data({ ...base, missing, error: ADMIN_EXTRA_COPY.bulkRowMissing }, { status: 400 });
  }

  const trpc = await createServerClient(request);
  try {
    const assigned = await trpc.qr.bulkAssign.mutate({
      items,
      venueId,
      spaceId: spaceId || undefined,
    });
    return data({ ...base, error: null, count: assigned.length });
  } catch (error) {
    return data({ ...base, error: errorMessage(error) }, { status: 400 });
  }
}

export default function BulkAssign() {
  const { batchId, codes, venues, createVenueUrl } = useLoaderData<typeof loader>();
  const result = useActionData<typeof action>();
  const navigation = useNavigation();
  const pending = navigation.state === 'submitting';

  // Everything up to the cap starts ticked, so the button already says the right count on the
  // server-rendered page. After a no-JavaScript fill the server sends the rows back.
  const [rows, setRows] = useState<AssignRow[]>(
    () =>
      result?.rows ??
      codes.map((code, index) => ({ code, label: '', ticked: index < QR_BULK_ASSIGN_MAX }))
  );
  const [fillText, setFillText] = useState('');
  const tickedCount = rows.filter(row => row.ticked).length;
  const missing = new Set(result?.missing ?? []);

  function update(code: string, change: Partial<AssignRow>) {
    setRows(current => current.map(row => (row.code === code ? { ...row, ...change } : row)));
  }

  if (result && !result.error) {
    return (
      <Chrome>
        <PageTitle className="mb-4">{ADMIN_COPY.bulkAssign.submit(result.count)}</PageTitle>
        <Link className={buttonVariants()} to={`/qr/batches/${batchId}`}>
          {ADMIN_COPY.batches.title}
        </Link>
      </Chrome>
    );
  }

  if (codes.length === 0) {
    return (
      <Chrome>
        <PageTitle className="mb-4">{ADMIN_EXTRA_COPY.assignSelected}</PageTitle>
        <p>{ADMIN_EXTRA_COPY.noUnassigned}</p>
      </Chrome>
    );
  }

  return (
    <Chrome>
      <PageTitle className="mb-2">{ADMIN_EXTRA_COPY.assignSelected}</PageTitle>
      <p className="mb-6 text-sm text-muted-foreground">{ADMIN_EXTRA_COPY.bulkLimit}</p>
      <Form method="post" className="max-w-md space-y-4">
        {/* Enter in a field presses the form's first submit button. Without this, that is "Fill
            labels"; this keeps Enter meaning "Activate". Off screen rather than display:none,
            which Safari skips for implicit submission. */}
        <button
          type="submit"
          tabIndex={-1}
          aria-hidden="true"
          className="absolute -left-[9999px] h-px w-px overflow-hidden"
        />
        <VenuePicker
          venues={venues}
          createVenueUrl={createVenueUrl}
          initialVenueId={result?.venueId || undefined}
        />
        <p className="text-sm text-muted-foreground">{ADMIN_EXTRA_COPY.bulkLabelsHint}</p>

        <Field
          label={ADMIN_EXTRA_COPY.bulkFillLabel}
          htmlFor="fillText"
          hint={ADMIN_EXTRA_COPY.bulkFillHint}
        >
          <div className="flex gap-2">
            <Input
              id="fillText"
              name="fillText"
              maxLength={55}
              value={fillText}
              onChange={event => setFillText(event.target.value)}
              placeholder={ADMIN_COPY.assign.labelPlaceholder}
            />
            <Button
              type="submit"
              variant="outline"
              name="intent"
              value="fill"
              formNoValidate
              onClick={event => {
                // With JavaScript fill in the page. Without it the form posts and the server fills.
                event.preventDefault();
                setRows(current => fillLabels(current, fillText));
              }}
            >
              {ADMIN_EXTRA_COPY.bulkFill}
            </Button>
          </div>
        </Field>

        <fieldset className="space-y-1">
          <legend className="sr-only">{ADMIN_EXTRA_COPY.tableCode}</legend>
          <ul className="divide-y divide-border rounded-md border border-border">
            {rows.map(row => (
              <li key={row.code} className="px-3 py-2">
                <div className="flex min-h-tap items-center gap-3">
                  <input
                    id={`c-${row.code}`}
                    type="checkbox"
                    name="codes"
                    value={row.code}
                    className="h-5 w-5"
                    checked={row.ticked}
                    onChange={event => update(row.code, { ticked: event.target.checked })}
                  />
                  <label htmlFor={`c-${row.code}`} className="font-mono">
                    {row.code}
                  </label>
                  <Input
                    name={`label-${row.code}`}
                    aria-label={ADMIN_EXTRA_COPY.bulkRowLabel(row.code)}
                    aria-invalid={missing.has(row.code) || undefined}
                    maxLength={60}
                    className="flex-1"
                    value={row.label}
                    onChange={event => update(row.code, { label: event.target.value })}
                    placeholder={ADMIN_COPY.assign.labelPlaceholder}
                  />
                </div>
                {missing.has(row.code) && row.ticked && !row.label.trim() ? (
                  <FormError>{ADMIN_EXTRA_COPY.bulkRowMissing}</FormError>
                ) : null}
              </li>
            ))}
          </ul>
        </fieldset>

        {missing.size === 0 ? <FormError>{result?.error}</FormError> : null}
        <Button type="submit" pending={pending} disabled={tickedCount === 0}>
          {ADMIN_COPY.bulkAssign.submit(tickedCount)}
        </Button>
      </Form>
    </Chrome>
  );
}
