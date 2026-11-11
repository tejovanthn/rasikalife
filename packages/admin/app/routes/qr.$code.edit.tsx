import { Button, Field, Input, PageTitle } from '@rasika/ui';
import type { ActionFunctionArgs, LoaderFunctionArgs } from 'react-router';
import { Form, data, redirect, useActionData, useLoaderData, useNavigation } from 'react-router';
import { Chrome, FormError } from '~/components/chrome';
import { VenuePicker } from '~/components/venue-picker';
import { createServerClient, errorMessage, loadVenueOptions, siteUrl } from '~/lib/api.server';
import { requireModerator } from '~/lib/auth.server';
import { ADMIN_COPY, ADMIN_EXTRA_COPY } from '~/lib/copy';
import { pageMeta } from '~/lib/meta';
import { parseCodeInput } from '~/lib/qr-admin';

export const meta = () => pageMeta(ADMIN_EXTRA_COPY.edit);

function strictCode(raw: string | undefined): string {
  const code = parseCodeInput(raw);
  if (!code || code !== raw) throw data(null, { status: 404 });
  return code;
}

/** `?intent=label` changes only the label; `?intent=reassign` moves the code to a venue. */
function intentOf(request: Request): 'label' | 'reassign' {
  return new URL(request.url).searchParams.get('intent') === 'reassign' ? 'reassign' : 'label';
}

export async function loader({ request, params }: LoaderFunctionArgs) {
  await requireModerator(request);
  const code = strictCode(params.code);
  const intent = intentOf(request);
  const trpc = await createServerClient(request);
  let qr: Awaited<ReturnType<typeof trpc.qr.get.query>>;
  try {
    qr = await trpc.qr.get.query({ code });
  } catch (error) {
    if ((error as { data?: { code?: string } }).data?.code === 'NOT_FOUND') {
      throw data(null, { status: 404 });
    }
    throw error;
  }
  const venues =
    intent === 'reassign' && qr.status === 'active' ? await loadVenueOptions(trpc) : [];
  return {
    code,
    intent,
    status: qr.status,
    label: qr.label ?? '',
    venueId: qr.venueId ?? '',
    createVenueUrl: `${siteUrl()}/venues/new`,
    venues,
  };
}

export async function action({ request, params }: ActionFunctionArgs) {
  await requireModerator(request);
  const code = strictCode(params.code);
  const intent = intentOf(request);
  const form = await request.formData();
  const label = String(form.get('label') ?? '').trim();
  if (!label) return data({ error: ADMIN_COPY.assign.label }, { status: 400 });

  const trpc = await createServerClient(request);
  try {
    if (intent === 'reassign') {
      const venueId = String(form.get('venueId') ?? '');
      const spaceId = String(form.get('spaceId') ?? '');
      if (!venueId) return data({ error: ADMIN_COPY.assign.venue }, { status: 400 });
      await trpc.qr.reassign.mutate({ code, venueId, spaceId: spaceId || undefined, label });
    } else {
      await trpc.qr.updateLabel.mutate({ code, label });
    }
    return redirect('/qr');
  } catch (error) {
    return data({ error: errorMessage(error) }, { status: 400 });
  }
}

export default function EditCode() {
  const loaded = useLoaderData<typeof loader>();
  const result = useActionData<typeof action>();
  const navigation = useNavigation();
  const pending = navigation.state === 'submitting';
  const reassigning = loaded.intent === 'reassign';

  if (loaded.status !== 'active') {
    return (
      <Chrome>
        <PageTitle className="mb-4">{loaded.code}</PageTitle>
        <p>
          {loaded.status === 'retired'
            ? ADMIN_EXTRA_COPY.retiredNotice
            : ADMIN_EXTRA_COPY.unassignedNotice}
        </p>
      </Chrome>
    );
  }

  return (
    <Chrome>
      <PageTitle className="mb-6">
        {reassigning ? ADMIN_EXTRA_COPY.reassign : ADMIN_EXTRA_COPY.edit} {loaded.code}
      </PageTitle>
      <Form method="post" className="max-w-md space-y-4">
        {reassigning ? (
          <VenuePicker
            venues={loaded.venues}
            initialVenueId={loaded.venueId}
            createVenueUrl={loaded.createVenueUrl}
          />
        ) : null}
        <Field label={ADMIN_COPY.assign.label} htmlFor="label">
          <Input
            id="label"
            name="label"
            maxLength={60}
            required
            defaultValue={loaded.label}
            placeholder={ADMIN_COPY.assign.labelPlaceholder}
          />
        </Field>
        <FormError>{result?.error}</FormError>
        <Button type="submit" pending={pending}>
          {reassigning ? ADMIN_EXTRA_COPY.saveReassign : ADMIN_EXTRA_COPY.saveLabel}
        </Button>
      </Form>
    </Chrome>
  );
}
