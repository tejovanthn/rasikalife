import {
  Badge,
  Button,
  EmptyState,
  Field,
  Input,
  PageTitle,
  SectionTitle,
  Select,
  Table,
  TableScroll,
  Td,
  Th,
  Tr,
  buttonVariants,
} from '@rasika/ui';
import type { LoaderFunctionArgs } from 'react-router';
import { Form, Link, redirect, useLoaderData } from 'react-router';
import { Chrome } from '~/components/chrome';
import { createServerClient, loadVenueOptions } from '~/lib/api.server';
import { requireModerator } from '~/lib/auth.server';
import { ADMIN_COPY, ADMIN_EXTRA_COPY } from '~/lib/copy';
import { pageMeta } from '~/lib/meta';
import { assignPath, formatWhen, parseCodeInput, parseListFilters } from '~/lib/qr-admin';

export const meta = () => pageMeta(ADMIN_COPY.batches.title);

const TONE = { unassigned: 'neutral', active: 'success', retired: 'warning' } as const;

export async function loader({ request }: LoaderFunctionArgs) {
  await requireModerator(request);
  const url = new URL(request.url);

  // The "Assign code" box is a GET form, so it works without JavaScript.
  if (url.searchParams.has('code')) {
    const code = parseCodeInput(url.searchParams.get('code'));
    if (code) return redirect(assignPath(code));
  }
  const codeError = url.searchParams.has('code') ? ADMIN_EXTRA_COPY.invalidCode : null;

  const filters = parseListFilters(url.searchParams);
  const trpc = await createServerClient(request);
  const [codes, batches, venues] = await Promise.all([
    trpc.qr.list.query({ ...filters, limit: 50 }),
    trpc.qr.listBatches.query({ limit: 50 }),
    loadVenueOptions(trpc),
  ]);
  return { codes, batches: batches.items, venues, filters, codeError };
}

export default function QrIndex() {
  const { codes, batches, venues, filters, codeError } = useLoaderData<typeof loader>();

  return (
    <Chrome>
      <div className="mb-6 flex items-center justify-between gap-4">
        <PageTitle>{ADMIN_COPY.batches.title}</PageTitle>
        <Link to="/qr/batches/new" className={buttonVariants()}>
          {ADMIN_COPY.batches.newBatch}
        </Link>
      </div>

      <Form method="get" className="mb-8 max-w-md space-y-1">
        <Field
          label={ADMIN_EXTRA_COPY.assignBox}
          htmlFor="assign-code"
          hint={ADMIN_EXTRA_COPY.assignBoxHint}
          error={codeError}
        >
          <div className="flex gap-2">
            <Input
              id="assign-code"
              name="code"
              autoComplete="off"
              autoCapitalize="characters"
              maxLength={12}
            />
            <Button type="submit">{ADMIN_EXTRA_COPY.assignBoxSubmit}</Button>
          </div>
        </Field>
      </Form>

      <section className="mb-10">
        <SectionTitle className="mb-3">{ADMIN_EXTRA_COPY.codes}</SectionTitle>
        <Form method="get" className="mb-4 flex flex-wrap items-end gap-3">
          <Field label={ADMIN_EXTRA_COPY.filterStatus} htmlFor="f-status">
            <Select id="f-status" name="status" defaultValue={filters.status ?? ''}>
              <option value="">{ADMIN_EXTRA_COPY.filterAll}</option>
              <option value="unassigned">{ADMIN_EXTRA_COPY.statuses.unassigned}</option>
              <option value="active">{ADMIN_EXTRA_COPY.statuses.active}</option>
              <option value="retired">{ADMIN_EXTRA_COPY.statuses.retired}</option>
            </Select>
          </Field>
          <Field label={ADMIN_EXTRA_COPY.filterBatch} htmlFor="f-batch">
            <Select id="f-batch" name="batchId" defaultValue={filters.batchId ?? ''}>
              <option value="">{ADMIN_EXTRA_COPY.filterAll}</option>
              {batches.map(batch => (
                <option key={batch.id} value={batch.id}>
                  {formatWhen(batch.createdAt)}
                  {batch.note ? `, ${batch.note}` : ''}
                </option>
              ))}
            </Select>
          </Field>
          <Field label={ADMIN_EXTRA_COPY.filterVenue} htmlFor="f-venue">
            <Select id="f-venue" name="venueId" defaultValue={filters.venueId ?? ''}>
              <option value="">{ADMIN_EXTRA_COPY.filterAll}</option>
              {venues.map(venue => (
                <option key={venue.id} value={venue.id}>
                  {venue.name}
                </option>
              ))}
            </Select>
          </Field>
          <Button type="submit" variant="outline">
            {ADMIN_EXTRA_COPY.filterApply}
          </Button>
        </Form>

        {codes.items.length === 0 ? (
          <EmptyState title={ADMIN_EXTRA_COPY.noCodes} />
        ) : (
          <TableScroll>
            <Table>
              <thead>
                <tr>
                  <Th>{ADMIN_EXTRA_COPY.tableCode}</Th>
                  <Th>{ADMIN_EXTRA_COPY.tableStatus}</Th>
                  <Th>{ADMIN_EXTRA_COPY.tableVenue}</Th>
                  <Th>{ADMIN_EXTRA_COPY.tableLabel}</Th>
                  <Th>{ADMIN_EXTRA_COPY.tableScans}</Th>
                  <Th>{ADMIN_EXTRA_COPY.tableFollows}</Th>
                  <Th />
                </tr>
              </thead>
              <tbody>
                {codes.items.map(qr => (
                  <Tr key={qr.code}>
                    <Td className="font-mono">{qr.code}</Td>
                    <Td>
                      <Badge tone={TONE[qr.status]}>{ADMIN_EXTRA_COPY.statuses[qr.status]}</Badge>
                    </Td>
                    <Td>{qr.venueName ?? ''}</Td>
                    <Td>{qr.label ?? ''}</Td>
                    <Td>{qr.scanCount ?? 0}</Td>
                    <Td>{qr.followCount ?? 0}</Td>
                    <Td className="space-x-3 whitespace-nowrap text-right">
                      {qr.status === 'unassigned' ? (
                        <Link className="text-primary underline" to={assignPath(qr.code)}>
                          {ADMIN_COPY.assign.submit}
                        </Link>
                      ) : null}
                      {qr.status === 'active' ? (
                        <>
                          <Link
                            className="text-primary underline"
                            to={`/qr/${qr.code}/edit?intent=label`}
                          >
                            {ADMIN_EXTRA_COPY.edit}
                          </Link>
                          <Link
                            className="text-primary underline"
                            to={`/qr/${qr.code}/edit?intent=reassign`}
                          >
                            {ADMIN_EXTRA_COPY.reassign}
                          </Link>
                        </>
                      ) : null}
                      {qr.status !== 'retired' ? (
                        <Link className="text-destructive underline" to={`/qr/${qr.code}/retire`}>
                          {ADMIN_EXTRA_COPY.retireAction}
                        </Link>
                      ) : null}
                    </Td>
                  </Tr>
                ))}
              </tbody>
            </Table>
          </TableScroll>
        )}
        {codes.hasMore && codes.nextToken ? (
          <p className="mt-3">
            <Link
              className="text-primary underline"
              to={`?${new URLSearchParams(
                Object.entries({ ...filters, cursor: codes.nextToken }).filter(
                  (entry): entry is [string, string] => Boolean(entry[1])
                )
              )}`}
            >
              {ADMIN_EXTRA_COPY.loadMore}
            </Link>
          </p>
        ) : null}
      </section>

      <section>
        <SectionTitle className="mb-3">{ADMIN_EXTRA_COPY.batchesHeading}</SectionTitle>
        {batches.length === 0 ? (
          <EmptyState title={ADMIN_EXTRA_COPY.noBatches} />
        ) : (
          <TableScroll>
            <Table>
              <thead>
                <tr>
                  <Th>{ADMIN_EXTRA_COPY.tableCreated}</Th>
                  <Th>{ADMIN_EXTRA_COPY.tableFormat}</Th>
                  <Th>{ADMIN_EXTRA_COPY.tableCount}</Th>
                  <Th>{ADMIN_EXTRA_COPY.tableNote}</Th>
                  <Th>{ADMIN_EXTRA_COPY.tablePdf}</Th>
                </tr>
              </thead>
              <tbody>
                {batches.map(batch => (
                  <Tr key={batch.id}>
                    <Td>
                      <Link className="text-primary underline" to={`/qr/batches/${batch.id}`}>
                        {formatWhen(batch.createdAt)}
                      </Link>
                    </Td>
                    <Td>{ADMIN_COPY.newBatch.formats[batch.format]}</Td>
                    <Td>{batch.count}</Td>
                    <Td>{batch.note ?? ''}</Td>
                    <Td>
                      {batch.pdfStatus === 'ready'
                        ? ADMIN_COPY.batch.ready
                        : batch.pdfStatus === 'failed'
                          ? ADMIN_COPY.batch.failed
                          : ADMIN_COPY.batch.pending}
                    </Td>
                  </Tr>
                ))}
              </tbody>
            </Table>
          </TableScroll>
        )}
      </section>
    </Chrome>
  );
}
