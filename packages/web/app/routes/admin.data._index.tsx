import { ADMIN_CSV_DOMAINS } from '@rasika/core/admin/columns';
import { Database } from 'lucide-react';
import type { MetaFunction } from 'react-router';
import { Link } from 'react-router';
import { requireAdmin } from '~/lib/auth.server';

export const meta: MetaFunction = () => {
  return [{ title: 'Manage Data' }, { name: 'robots', content: 'noindex, nofollow' }];
};

export async function loader({ request }: { request: Request }) {
  await requireAdmin(request);
  return null;
}

export default function AdminDataIndex() {
  const domains = Object.entries(ADMIN_CSV_DOMAINS);

  return (
    <div className="max-w-3xl mx-auto px-4 py-8 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Manage Data</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Export any domain to CSV, edit it in a spreadsheet, and re-upload to update the database.
        </p>
      </div>
      <ul className="grid gap-3 sm:grid-cols-2">
        {domains.map(([slug, config]) => (
          <li key={slug}>
            <Link
              to={`/admin/data/${slug}`}
              className="flex items-center gap-3 rounded-lg border p-4 hover:bg-accent transition-colors"
            >
              <Database className="h-5 w-5 text-muted-foreground" />
              <span className="font-medium text-foreground">{config.label}</span>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
