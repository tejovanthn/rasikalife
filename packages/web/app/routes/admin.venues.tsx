import type { Venue } from '@rasika/core/domain/venue/client';
import { Download, Upload } from 'lucide-react';
import type { MetaFunction } from 'react-router';
import { data, useFetcher, useLoaderData } from 'react-router';
import { createServerClient } from '~/api.server';
import { Button } from '~/components/ui/button';
import { requireAdmin } from '~/lib/auth.server';
import { parseVenuesCsv, venuesToCsv } from '~/lib/venue-csv';

interface BulkImportResult {
  created: number;
  updated: number;
  errors: Array<{ index: number; name?: string; message: string }>;
}

type ActionData =
  | { error: string; parseErrors?: string[] }
  | { result: BulkImportResult; parseErrors: string[] };

export const meta: MetaFunction = () => {
  return [{ title: 'Manage Venues' }, { name: 'robots', content: 'noindex, nofollow' }];
};

export async function loader({ request }: { request: Request }) {
  await requireAdmin(request);
  const serverClient = await createServerClient(request);
  const venues = await serverClient.venue.exportAll.query();

  const url = new URL(request.url);
  if (url.searchParams.has('export')) {
    const filename = `venues-${new Date().toISOString().slice(0, 10)}.csv`;
    return new Response(venuesToCsv(venues as Venue[]), {
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="${filename}"`,
      },
    });
  }

  return data({ count: venues.length });
}

export async function action({ request }: { request: Request }) {
  await requireAdmin(request);
  const formData = await request.formData();
  const file = formData.get('file');

  if (!(file instanceof File) || file.size === 0) {
    return data({ error: 'Choose a CSV file to upload.' } satisfies ActionData, { status: 400 });
  }

  const { rows, errors: parseErrors } = parseVenuesCsv(await file.text());
  if (rows.length === 0) {
    return data({
      error: 'No usable rows were found in that CSV.',
      parseErrors,
    } satisfies ActionData);
  }

  const serverClient = await createServerClient(request);
  const result = await serverClient.venue.bulkImport.mutate({ rows });
  return data({ result, parseErrors } satisfies ActionData);
}

export default function AdminVenues() {
  const { count } = useLoaderData<typeof loader>() as { count: number };
  const fetcher = useFetcher<ActionData>();
  const busy = fetcher.state !== 'idle';
  const actionData = fetcher.data;

  const result = actionData && 'result' in actionData ? actionData.result : null;
  const error = actionData && 'error' in actionData ? actionData.error : null;
  const parseErrors = actionData?.parseErrors ?? [];

  return (
    <div className="max-w-3xl mx-auto px-4 py-8 space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Manage Venues</h1>
        <p className="text-sm text-muted-foreground mt-1">
          {count} venue{count === 1 ? '' : 's'} in the database.
        </p>
      </div>

      <section className="rounded-lg border p-5 space-y-3">
        <h2 className="text-lg font-semibold text-foreground">Export</h2>
        <p className="text-sm text-muted-foreground">
          Download every venue as a CSV. Edit it in a spreadsheet, then upload it below to apply
          your changes. Keep the <code className="text-xs">id</code> column intact so existing
          venues are updated instead of duplicated.
        </p>
        <Button asChild>
          <a href="?export=1" download>
            <Download className="h-4 w-4 mr-2" />
            Download venues CSV
          </a>
        </Button>
      </section>

      <section className="rounded-lg border p-5 space-y-3">
        <h2 className="text-lg font-semibold text-foreground">Bulk upload</h2>
        <p className="text-sm text-muted-foreground">
          Rows with an existing <code className="text-xs">id</code> update that venue; rows with a
          blank <code className="text-xs">id</code> create a new one. Each row is validated on its
          own, so a bad row is reported without blocking the rest.
        </p>
        <fetcher.Form
          method="post"
          encType="multipart/form-data"
          className="flex flex-wrap items-center gap-3"
        >
          <input
            type="file"
            name="file"
            accept=".csv,text/csv"
            required
            className="text-sm file:mr-3 file:rounded-md file:border file:border-input file:bg-background file:px-3 file:py-1.5 file:text-sm"
          />
          <Button type="submit" disabled={busy}>
            <Upload className="h-4 w-4 mr-2" />
            {busy ? 'Uploading…' : 'Upload CSV'}
          </Button>
        </fetcher.Form>

        {error ? <p className="text-sm text-destructive">{error}</p> : null}

        {result ? (
          <div className="rounded-md bg-muted p-3 text-sm space-y-2">
            <p className="font-medium text-foreground">
              Created {result.created}, updated {result.updated}
              {result.errors.length > 0 ? `, ${result.errors.length} failed` : ''}.
            </p>
            {result.errors.length > 0 ? (
              <ul className="list-disc pl-5 space-y-1 text-destructive">
                {result.errors.map(err => (
                  <li key={`${err.index}-${err.message}`}>
                    Row {err.index + 1}
                    {err.name ? ` (${err.name})` : ''}: {err.message}
                  </li>
                ))}
              </ul>
            ) : null}
          </div>
        ) : null}

        {parseErrors.length > 0 ? (
          <ul className="list-disc pl-5 space-y-1 text-sm text-amber-600 dark:text-amber-500">
            {parseErrors.map(message => (
              <li key={message}>{message}</li>
            ))}
          </ul>
        ) : null}
      </section>
    </div>
  );
}
