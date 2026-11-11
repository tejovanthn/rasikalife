import { Button, Field, Input, PageTitle, buttonVariants } from '@rasika/ui';
import type { ActionFunctionArgs, LoaderFunctionArgs } from 'react-router';
import { Form, Link, data, useActionData, useLoaderData, useNavigation } from 'react-router';
import { Chrome, FormError } from '~/components/chrome';
import { VenuePicker } from '~/components/venue-picker';
import { createServerClient, errorMessage, loadVenueOptions, siteUrl } from '~/lib/api.server';
import { requireModerator } from '~/lib/auth.server';
import { ADMIN_COPY, ADMIN_EXTRA_COPY } from '~/lib/copy';
import { pageMeta } from '~/lib/meta';
import { parseCodeInput, testScanUrl } from '~/lib/qr-admin';

export const meta = () => pageMeta(ADMIN_COPY.assign.submit);

/** The route only takes a code in its exact form: 8 characters of the alphabet. */
function strictCode(raw: string | undefined): string {
  const code = parseCodeInput(raw);
  if (!code || code !== raw) throw data(null, { status: 404 });
  return code;
}

export async function loader({ request, params }: LoaderFunctionArgs) {
  await requireModerator(request);
  const code = strictCode(params.code);
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
  const venues = qr.status === 'unassigned' ? await loadVenueOptions(trpc) : [];
  const site = siteUrl();
  return {
    code,
    status: qr.status,
    venueName: qr.venueName ?? '',
    venues,
    testScan: testScanUrl(site, code),
    createVenueUrl: `${site}/venues/new`,
  };
}

export async function action({ request, params }: ActionFunctionArgs) {
  await requireModerator(request);
  const code = strictCode(params.code);
  const form = await request.formData();
  const venueId = String(form.get('venueId') ?? '');
  const spaceId = String(form.get('spaceId') ?? '');
  const label = String(form.get('label') ?? '').trim();
  const note = String(form.get('note') ?? '').trim();
  if (!venueId) return data({ error: ADMIN_COPY.assign.venue, done: null }, { status: 400 });
  if (!label) return data({ error: ADMIN_COPY.assign.label, done: null }, { status: 400 });

  const trpc = await createServerClient(request);
  try {
    const qr = await trpc.qr.assign.mutate({
      code,
      venueId,
      spaceId: spaceId || undefined,
      label,
      note: note || undefined,
    });
    return data({ error: null, done: { venueName: qr.venueName ?? '' } });
  } catch (error) {
    return data({ error: errorMessage(error), done: null }, { status: 400 });
  }
}

export default function AssignCode() {
  const loaded = useLoaderData<typeof loader>();
  const result = useActionData<typeof action>();
  const navigation = useNavigation();
  const pending = navigation.state === 'submitting';

  const heading = <PageTitle className="mb-6">{ADMIN_COPY.assign.title(loaded.code)}</PageTitle>;
  const testLink = (
    <a className={buttonVariants({ variant: 'outline' })} href={loaded.testScan}>
      {ADMIN_COPY.assign.testScan}
    </a>
  );

  if (result?.done) {
    return (
      <Chrome>
        {heading}
        <output className="mb-4 block">
          {ADMIN_COPY.assign.success(loaded.code, result.done.venueName)}
        </output>
        <div className="flex gap-3">
          {testLink}
          <Link className={buttonVariants({ variant: 'ghost' })} to="/qr">
            {ADMIN_COPY.batches.title}
          </Link>
        </div>
      </Chrome>
    );
  }

  if (loaded.status === 'active') {
    return (
      <Chrome>
        {heading}
        <output className="mb-4 block">{ADMIN_COPY.assign.alreadyActive(loaded.venueName)}</output>
        {testLink}
      </Chrome>
    );
  }

  if (loaded.status === 'retired') {
    return (
      <Chrome>
        {heading}
        <p>{ADMIN_EXTRA_COPY.retiredNotice}</p>
      </Chrome>
    );
  }

  return (
    <Chrome>
      {heading}
      <Form method="post" className="max-w-md space-y-4">
        <VenuePicker venues={loaded.venues} createVenueUrl={loaded.createVenueUrl} />
        <Field label={ADMIN_COPY.assign.label} htmlFor="label">
          <Input
            id="label"
            name="label"
            maxLength={60}
            required
            placeholder={ADMIN_COPY.assign.labelPlaceholder}
          />
        </Field>
        <Field label={ADMIN_COPY.assign.note} htmlFor="note">
          <Input id="note" name="note" maxLength={200} />
        </Field>
        <FormError>{result?.error}</FormError>
        <Button type="submit" pending={pending}>
          {ADMIN_COPY.assign.submit}
        </Button>
      </Form>
    </Chrome>
  );
}
