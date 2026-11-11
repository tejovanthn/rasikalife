import { QR_BATCH_MAX, QR_FORMATS } from '@rasika/core/domain/venue-qr/client';
import { Button, Field, Input, PageTitle, Select } from '@rasika/ui';
import type { ActionFunctionArgs, LoaderFunctionArgs } from 'react-router';
import { Form, data, redirect, useActionData, useNavigation } from 'react-router';
import { Chrome, FormError } from '~/components/chrome';
import { createServerClient, errorMessage } from '~/lib/api.server';
import { requireModerator } from '~/lib/auth.server';
import { ADMIN_COPY } from '~/lib/copy';
import { pageMeta } from '~/lib/meta';

export const meta = () => pageMeta(ADMIN_COPY.batches.newBatch);

export async function loader({ request }: LoaderFunctionArgs) {
  await requireModerator(request);
  return {};
}

export async function action({ request }: ActionFunctionArgs) {
  await requireModerator(request);
  const form = await request.formData();
  const count = Number(form.get('count'));
  const format = String(form.get('format') ?? '');
  const note = String(form.get('note') ?? '').trim();

  if (!Number.isInteger(count) || count < 1 || count > QR_BATCH_MAX) {
    return data({ error: ADMIN_COPY.newBatch.count }, { status: 400 });
  }
  if (!(QR_FORMATS as readonly string[]).includes(format)) {
    return data({ error: ADMIN_COPY.newBatch.format }, { status: 400 });
  }

  const trpc = await createServerClient(request);
  try {
    const { batch } = await trpc.qr.createBatch.mutate({
      count,
      format: format as (typeof QR_FORMATS)[number],
      note: note || undefined,
    });
    return redirect(`/qr/batches/${batch.id}`);
  } catch (error) {
    return data({ error: errorMessage(error) }, { status: 400 });
  }
}

export default function NewBatch() {
  const result = useActionData<typeof action>();
  const navigation = useNavigation();
  const pending = navigation.state === 'submitting';

  return (
    <Chrome>
      <PageTitle className="mb-6">{ADMIN_COPY.batches.newBatch}</PageTitle>
      <Form method="post" className="max-w-md space-y-4">
        <Field label={ADMIN_COPY.newBatch.count} htmlFor="count">
          <Input
            id="count"
            name="count"
            type="number"
            inputMode="numeric"
            min={1}
            max={QR_BATCH_MAX}
            defaultValue={50}
            required
          />
        </Field>
        <Field label={ADMIN_COPY.newBatch.format} htmlFor="format">
          <Select id="format" name="format" defaultValue="sticker">
            {QR_FORMATS.map(format => (
              <option key={format} value={format}>
                {ADMIN_COPY.newBatch.formats[format]}
              </option>
            ))}
          </Select>
        </Field>
        <Field label={ADMIN_COPY.newBatch.note} htmlFor="note">
          <Input id="note" name="note" maxLength={200} />
        </Field>
        <FormError>{result?.error}</FormError>
        <Button type="submit" pending={pending}>
          {ADMIN_COPY.newBatch.submit}
        </Button>
      </Form>
    </Chrome>
  );
}
