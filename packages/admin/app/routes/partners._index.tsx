import {
  Badge,
  Button,
  EmptyState,
  Field,
  Input,
  PageTitle,
  Table,
  TableScroll,
  Td,
  Th,
  Tr,
} from '@rasika/ui';
import type { LoaderFunctionArgs } from 'react-router';
import { Form, Link, useLoaderData } from 'react-router';
import { Chrome } from '~/components/chrome';
import { createServerClient, loadOrganiserOptions, loadVenueOptions } from '~/lib/api.server';
import { requireModerator } from '~/lib/auth.server';
import { ADMIN_EXTRA_COPY } from '~/lib/copy';
import { pageMeta } from '~/lib/meta';
import { partnerPath, searchPartnerTargets } from '~/lib/partners';
import type { PartnerTarget } from '~/lib/partners';

export const meta = () => pageMeta(ADMIN_EXTRA_COPY.partners);

/**
 * A search box over organisers and venues. It is a GET form, so it works without JavaScript.
 * The whole list of both is read (a few hundred rows) and filtered on the server per search.
 */
export async function loader({ request }: LoaderFunctionArgs) {
  await requireModerator(request);
  const query = new URL(request.url).searchParams.get('q') ?? '';
  if (!query.trim()) return { query, results: [] as PartnerTarget[] };

  const trpc = await createServerClient(request);
  const [organisers, venues] = await Promise.all([
    loadOrganiserOptions(trpc),
    loadVenueOptions(trpc),
  ]);
  const targets: PartnerTarget[] = [
    ...organisers.map(o => ({ ...o, targetType: 'organiser' as const })),
    ...venues.map(v => ({ ...v, targetType: 'venue' as const })),
  ];
  return { query, results: searchPartnerTargets(targets, query) };
}

export default function PartnersIndex() {
  const { query, results } = useLoaderData<typeof loader>();

  return (
    <Chrome>
      <PageTitle className="mb-6">{ADMIN_EXTRA_COPY.partners}</PageTitle>
      <Form method="get" className="mb-8 max-w-md">
        <Field label={ADMIN_EXTRA_COPY.partnersSearch} htmlFor="partners-q">
          <div className="flex gap-2">
            <Input id="partners-q" name="q" type="search" defaultValue={query} autoComplete="off" />
            <Button type="submit">{ADMIN_EXTRA_COPY.partnersSearchSubmit}</Button>
          </div>
        </Field>
      </Form>

      {query.trim() && results.length === 0 ? (
        <EmptyState title={ADMIN_EXTRA_COPY.partnersNoResults} />
      ) : null}

      {results.length > 0 ? (
        <TableScroll>
          <Table>
            <thead>
              <Tr>
                <Th>{ADMIN_EXTRA_COPY.partnersMemberName}</Th>
                <Th>{ADMIN_EXTRA_COPY.partnersTypeHeading}</Th>
              </Tr>
            </thead>
            <tbody>
              {results.map(result => (
                <Tr key={`${result.targetType}:${result.id}`}>
                  <Td>
                    <Link
                      className="text-primary underline"
                      to={partnerPath(result.targetType, result.id)}
                    >
                      {result.name}
                    </Link>
                    {result.city ? (
                      <span className="text-muted-foreground"> · {result.city}</span>
                    ) : null}
                  </Td>
                  <Td>
                    <Badge>{ADMIN_EXTRA_COPY.partnersType[result.targetType]}</Badge>
                  </Td>
                </Tr>
              ))}
            </tbody>
          </Table>
        </TableScroll>
      ) : null}
    </Chrome>
  );
}
