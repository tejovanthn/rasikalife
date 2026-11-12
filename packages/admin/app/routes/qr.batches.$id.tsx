import {
  Badge,
  Button,
  PageTitle,
  Table,
  TableScroll,
  Td,
  Th,
  Tr,
  buttonVariants,
} from '@rasika/ui';
import { useEffect } from 'react';
import type { ActionFunctionArgs, LoaderFunctionArgs } from 'react-router';
import { Form, Link, data, useLoaderData, useNavigation, useRevalidator } from 'react-router';
import { Chrome } from '~/components/chrome';
import { createServerClient, errorMessage } from '~/lib/api.server';
import { requireModerator } from '~/lib/auth.server';
import { ADMIN_COPY, ADMIN_EXTRA_COPY } from '~/lib/copy';
import { pageMeta } from '~/lib/meta';
import { assignPath, formatWhen, shouldPollBatch } from '~/lib/qr-admin';

export const meta = () => pageMeta(ADMIN_COPY.batches.title);

const TONE = { unassigned: 'neutral', active: 'success', retired: 'warning' } as const;
const POLL_MS = 3000;

export async function loader({ request, params }: LoaderFunctionArgs) {
  await requireModerator(request);
  const trpc = await createServerClient(request);
  try {
    return await trpc.qr.getBatch.query({ batchId: params.id ?? '' });
  } catch (error) {
    if ((error as { data?: { code?: string } }).data?.code === 'NOT_FOUND') {
      throw data(null, { status: 404 });
    }
    throw error;
  }
}

/** "PDF failed. Try again" and "Render PDF again": same codes, a new render (Spec: re-render on
 * demand, for example after a design change). */
export async function action({ request, params }: ActionFunctionArgs) {
  await requireModerator(request);
  const trpc = await createServerClient(request);
  try {
    await trpc.qr.rerenderBatch.mutate({ batchId: params.id ?? '' });
    return { error: null };
  } catch (error) {
    return { error: errorMessage(error) };
  }
}

export default function BatchPage() {
  const { batch, codes, downloadUrl } = useLoaderData<typeof loader>();
  const navigation = useNavigation();
  const revalidator = useRevalidator();
  const polling = shouldPollBatch(batch.pdfStatus);

  // Polls the loader until the renderer has finished. It stops by itself once the status moves.
  useEffect(() => {
    if (!polling) return;
    const timer = setInterval(() => {
      if (revalidator.state === 'idle') revalidator.revalidate();
    }, POLL_MS);
    return () => clearInterval(timer);
  }, [polling, revalidator]);

  const unassigned = codes.filter(code => code.status === 'unassigned');

  return (
    <Chrome>
      <p className="mb-2 text-sm">
        <Link className="text-primary underline" to="/qr">
          {ADMIN_EXTRA_COPY.batchBack}
        </Link>
      </p>
      <PageTitle className="mb-1">{ADMIN_COPY.newBatch.formats[batch.format]}</PageTitle>
      <p className="mb-6 text-sm text-muted-foreground">
        {formatWhen(batch.createdAt)}, {batch.count}
        {batch.note ? `, ${batch.note}` : ''}
      </p>

      <div className="mb-8 flex flex-wrap items-center gap-3" aria-live="polite">
        {batch.pdfStatus === 'ready' && downloadUrl ? (
          <>
            <a className={buttonVariants()} href={downloadUrl}>
              {ADMIN_COPY.batch.ready}
            </a>
            <Form method="post">
              <Button type="submit" variant="outline" pending={navigation.state !== 'idle'}>
                {ADMIN_EXTRA_COPY.pdfRerender}
              </Button>
            </Form>
          </>
        ) : batch.pdfStatus === 'failed' ? (
          <Form method="post">
            <Button type="submit" variant="destructive" pending={navigation.state !== 'idle'}>
              {ADMIN_COPY.batch.failed}
            </Button>
          </Form>
        ) : (
          <span className="text-muted-foreground">{ADMIN_COPY.batch.pending}</span>
        )}
        {unassigned.length > 0 ? (
          <Link
            className={buttonVariants({ variant: 'outline' })}
            to={`/qr/batches/${batch.id}/assign`}
          >
            {ADMIN_EXTRA_COPY.assignSelected}
          </Link>
        ) : null}
      </div>

      <TableScroll>
        <Table>
          <thead>
            <tr>
              <Th>{ADMIN_EXTRA_COPY.tableCode}</Th>
              <Th>{ADMIN_EXTRA_COPY.tableStatus}</Th>
              <Th>{ADMIN_EXTRA_COPY.tableVenue}</Th>
              <Th>{ADMIN_EXTRA_COPY.tableLabel}</Th>
              <Th />
            </tr>
          </thead>
          <tbody>
            {codes.map(qr => (
              <Tr key={qr.code}>
                <Td className="font-mono">{qr.code}</Td>
                <Td>
                  <Badge tone={TONE[qr.status]}>{ADMIN_EXTRA_COPY.statuses[qr.status]}</Badge>
                </Td>
                <Td>{qr.venueName ?? ''}</Td>
                <Td>{qr.label ?? ''}</Td>
                <Td className="text-right">
                  {qr.status === 'unassigned' ? (
                    <Link className="text-primary underline" to={assignPath(qr.code)}>
                      {ADMIN_COPY.assign.submit}
                    </Link>
                  ) : null}
                </Td>
              </Tr>
            ))}
          </tbody>
        </Table>
      </TableScroll>
    </Chrome>
  );
}
