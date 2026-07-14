import { ADMIN_CSV_DOMAINS, domainToCsv } from '@rasika/core/admin/columns';
import { createServerClient } from '~/api.server';
import { requireAdmin } from '~/lib/auth.server';

/**
 * Resource route (no component) so React Router returns the loader's raw CSV Response
 * directly. A UI route would render an HTML document instead, which the browser would
 * then save as .csv — the bug this route exists to avoid.
 */
export async function loader({
  request,
  params,
}: {
  request: Request;
  params: { domain?: string };
}) {
  await requireAdmin(request);
  const domain = params.domain ?? '';
  if (!ADMIN_CSV_DOMAINS[domain]) {
    throw new Response('Unknown data domain', { status: 404 });
  }

  const serverClient = await createServerClient(request);
  const entities = await serverClient.adminData.export.query({ domain });
  const filename = `${domain}-${new Date().toISOString().slice(0, 10)}.csv`;

  return new Response(domainToCsv(domain, entities as Record<string, unknown>[]), {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="${filename}"`,
    },
  });
}
