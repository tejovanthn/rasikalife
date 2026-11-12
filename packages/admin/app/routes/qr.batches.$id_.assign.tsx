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
import { numberedLabels, selectedCodes } from '~/lib/qr-admin';

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
  const labelPrefix = String(form.get('labelPrefix') ?? '').trim();

  const pageOrder = await unassignedCodes(request, batchId);
  const codes = selectedCodes(form.getAll('codes').map(String), pageOrder, QR_BULK_ASSIGN_MAX);
  if (codes.length === 0)
    return data({ error: ADMIN_EXTRA_COPY.bulkNone, count: 0 }, { status: 400 });
  if (!venueId) return data({ error: ADMIN_COPY.assign.venue, count: 0 }, { status: 400 });
  if (!labelPrefix) return data({ error: ADMIN_COPY.assign.label, count: 0 }, { status: 400 });

  const trpc = await createServerClient(request);
  try {
    const assigned = await trpc.qr.bulkAssign.mutate({
      codes,
      venueId,
      spaceId: spaceId || undefined,
      labelPrefix,
    });
    return data({ error: null, count: assigned.length });
  } catch (error) {
    return data({ error: errorMessage(error), count: 0 }, { status: 400 });
  }
}

export default function BulkAssign() {
  const { batchId, codes, venues, createVenueUrl } = useLoaderData<typeof loader>();
  const result = useActionData<typeof action>();
  const navigation = useNavigation();
  const pending = navigation.state === 'submitting';

  // Everything up to the cap starts ticked, so the button already says the right count on the
  // server-rendered page.
  const [chosen, setChosen] = useState<string[]>(() => codes.slice(0, QR_BULK_ASSIGN_MAX));
  const [prefix, setPrefix] = useState('');
  const preview = numberedLabels(prefix || ADMIN_COPY.assign.labelPlaceholder, chosen.length);

  function toggle(code: string, on: boolean) {
    setChosen(current => {
      const next = on ? [...current, code] : current.filter(c => c !== code);
      return codes.filter(c => next.includes(c));
    });
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
        <VenuePicker venues={venues} createVenueUrl={createVenueUrl} />
        <Field
          label={ADMIN_EXTRA_COPY.bulkPrefix}
          htmlFor="labelPrefix"
          hint={ADMIN_EXTRA_COPY.bulkPrefixHint}
        >
          <Input
            id="labelPrefix"
            name="labelPrefix"
            maxLength={55}
            required
            value={prefix}
            onChange={event => setPrefix(event.target.value)}
            placeholder={ADMIN_COPY.assign.labelPlaceholder}
          />
        </Field>

        <fieldset className="space-y-1">
          <legend className="sr-only">{ADMIN_EXTRA_COPY.tableCode}</legend>
          <ul className="divide-y divide-border rounded-md border border-border">
            {codes.map(code => {
              const index = chosen.indexOf(code);
              return (
                <li key={code} className="flex min-h-tap items-center gap-3 px-3">
                  <input
                    id={`c-${code}`}
                    type="checkbox"
                    name="codes"
                    value={code}
                    className="h-5 w-5"
                    checked={index >= 0}
                    onChange={event => toggle(code, event.target.checked)}
                  />
                  <label htmlFor={`c-${code}`} className="flex flex-1 justify-between gap-3">
                    <span className="font-mono">{code}</span>
                    <span className="text-sm text-muted-foreground">
                      {index >= 0 ? preview[index] : ''}
                    </span>
                  </label>
                </li>
              );
            })}
          </ul>
        </fieldset>

        <FormError>{result?.error}</FormError>
        <Button type="submit" pending={pending} disabled={chosen.length === 0}>
          {ADMIN_COPY.bulkAssign.submit(chosen.length)}
        </Button>
      </Form>
    </Chrome>
  );
}
