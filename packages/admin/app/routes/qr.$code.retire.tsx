import { Button, PageTitle, buttonVariants } from '@rasika/ui';
import type { ActionFunctionArgs, LoaderFunctionArgs } from 'react-router';
import {
  Form,
  Link,
  data,
  redirect,
  useActionData,
  useLoaderData,
  useNavigation,
} from 'react-router';
import { Chrome, FormError } from '~/components/chrome';
import { createServerClient, errorMessage } from '~/lib/api.server';
import { requireModerator } from '~/lib/auth.server';
import { ADMIN_COPY, ADMIN_EXTRA_COPY } from '~/lib/copy';
import { pageMeta } from '~/lib/meta';
import { parseCodeInput } from '~/lib/qr-admin';

export const meta = () => pageMeta(ADMIN_EXTRA_COPY.retireAction);

function strictCode(raw: string | undefined): string {
  const code = parseCodeInput(raw);
  if (!code || code !== raw) throw data(null, { status: 404 });
  return code;
}

/** A page, not a browser `confirm()`: it works without JavaScript and says what will happen. */
export async function loader({ request, params }: LoaderFunctionArgs) {
  await requireModerator(request);
  const code = strictCode(params.code);
  const trpc = await createServerClient(request);
  try {
    const qr = await trpc.qr.get.query({ code });
    return { code, status: qr.status, venueName: qr.venueName ?? '' };
  } catch (error) {
    if ((error as { data?: { code?: string } }).data?.code === 'NOT_FOUND') {
      throw data(null, { status: 404 });
    }
    throw error;
  }
}

export async function action({ request, params }: ActionFunctionArgs) {
  await requireModerator(request);
  const code = strictCode(params.code);
  const trpc = await createServerClient(request);
  try {
    await trpc.qr.retire.mutate({ code });
    return redirect('/qr');
  } catch (error) {
    return data({ error: errorMessage(error) }, { status: 400 });
  }
}

export default function RetireCode() {
  const loaded = useLoaderData<typeof loader>();
  const result = useActionData<typeof action>();
  const navigation = useNavigation();

  if (loaded.status === 'retired') {
    return (
      <Chrome>
        <PageTitle className="mb-4">{ADMIN_COPY.retire.title(loaded.code)}</PageTitle>
        <p>{ADMIN_EXTRA_COPY.retiredNotice}</p>
      </Chrome>
    );
  }

  return (
    <Chrome>
      <PageTitle className="mb-4">{ADMIN_COPY.retire.title(loaded.code)}</PageTitle>
      <p className="mb-6 max-w-md">
        {ADMIN_COPY.retire.body(loaded.venueName || ADMIN_EXTRA_COPY.filterVenue)}
      </p>
      <Form method="post" className="flex items-center gap-3">
        <Button type="submit" variant="destructive" pending={navigation.state === 'submitting'}>
          {ADMIN_COPY.retire.confirm}
        </Button>
        <Link className={buttonVariants({ variant: 'ghost' })} to="/qr">
          {ADMIN_EXTRA_COPY.cancel}
        </Link>
      </Form>
      <div className="mt-3">
        <FormError>{result?.error}</FormError>
      </div>
    </Chrome>
  );
}
