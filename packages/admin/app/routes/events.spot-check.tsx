import { EmptyState, PageTitle, Table, TableScroll, Td, Th, Tr } from '@rasika/ui';
import type { LoaderFunctionArgs } from 'react-router';
import { Link, useLoaderData } from 'react-router';
import { Chrome } from '~/components/chrome';
import { createServerClient, siteUrl } from '~/lib/api.server';
import { requireModerator } from '~/lib/auth.server';
import { ADMIN_EXTRA_COPY } from '~/lib/copy';
import { pageMeta } from '~/lib/meta';
import { formatEventWhen, partnerPath } from '~/lib/partners';

export const meta = () => pageMeta(ADMIN_EXTRA_COPY.spotCheck);

/**
 * The moderator spot-check feed: concerts that a verified owner published without review. To
 * put an organiser back on review, open it under Partners.
 */
export async function loader({ request }: LoaderFunctionArgs) {
  await requireModerator(request);
  const trpc = await createServerClient(request);
  const events = await trpc.partner.ownerPublishedEvents.query();
  return { events, siteUrl: siteUrl() };
}

export default function SpotCheck() {
  const { events, siteUrl: site } = useLoaderData<typeof loader>();

  return (
    <Chrome>
      <PageTitle className="mb-2">{ADMIN_EXTRA_COPY.spotCheck}</PageTitle>
      <p className="mb-6 text-sm text-muted-foreground">{ADMIN_EXTRA_COPY.spotCheckHint}</p>

      {events.length === 0 ? (
        <EmptyState title={ADMIN_EXTRA_COPY.spotCheckNone} />
      ) : (
        <TableScroll>
          <Table>
            <thead>
              <Tr>
                <Th>{ADMIN_EXTRA_COPY.spotCheckEvent}</Th>
                <Th>{ADMIN_EXTRA_COPY.spotCheckWhen}</Th>
                <Th>{ADMIN_EXTRA_COPY.spotCheckOrganiser}</Th>
                <Th>{ADMIN_EXTRA_COPY.spotCheckVenue}</Th>
                <Th>{ADMIN_EXTRA_COPY.spotCheckPublished}</Th>
              </Tr>
            </thead>
            <tbody>
              {events.map(event => (
                <Tr key={event.id}>
                  <Td>
                    <a className="text-primary underline" href={`${site}/events/${event.id}`}>
                      {event.title}
                    </a>
                  </Td>
                  <Td>{formatEventWhen(event.startDateTime, event.timezone)}</Td>
                  <Td>
                    {event.organiserId ? (
                      <Link className="underline" to={partnerPath('organiser', event.organiserId)}>
                        {event.organiserName ?? event.organiserId}
                      </Link>
                    ) : null}
                  </Td>
                  <Td>{event.venueName ?? ''}</Td>
                  <Td>
                    {event.ownerPublishedAt
                      ? formatEventWhen(event.ownerPublishedAt, 'Asia/Kolkata')
                      : ''}
                  </Td>
                </Tr>
              ))}
            </tbody>
          </Table>
        </TableScroll>
      )}
    </Chrome>
  );
}
