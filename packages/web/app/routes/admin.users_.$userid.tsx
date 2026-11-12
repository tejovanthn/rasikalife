import type { LoaderFunctionArgs, MetaFunction } from 'react-router';
import { Link, data, useLoaderData } from 'react-router';
import { createServerClient } from '~/api.server';
import { requireAdmin } from '~/lib/auth.server';

export const meta: MetaFunction = () => [{ name: 'robots', content: 'noindex, nofollow' }];

/**
 * One user, for admins. This is the only screen that shows a full WhatsApp number, and each load
 * writes an audit row (`user.adminDetail`). Never cached.
 */
export async function loader({ params, request }: LoaderFunctionArgs) {
  await requireAdmin(request);
  const client = await createServerClient(request);
  const user = await client.user.adminDetail.query({ userId: params.userid ?? '' });
  return data({ user }, { headers: { 'Cache-Control': 'private, no-store' } });
}

export default function AdminUserDetail() {
  const { user } = useLoaderData<typeof loader>();
  return (
    <main className="mx-auto max-w-2xl space-y-4 p-4">
      <p>
        <Link to="/admin/users" className="underline">
          All users
        </Link>
      </p>
      <h1 className="text-2xl font-semibold">{user.name}</h1>
      <dl className="grid grid-cols-[10rem_1fr] gap-2 text-sm">
        <dt className="text-muted-foreground">Email</dt>
        <dd>{user.email}</dd>
        <dt className="text-muted-foreground">Role</dt>
        <dd>{user.role}</dd>
        <dt className="text-muted-foreground">WhatsApp</dt>
        <dd>
          {user.whatsappNumber ?? 'None'}
          {user.whatsappNumber ? (user.whatsappVerified ? ' (verified)' : ' (not verified)') : ''}
        </dd>
        <dt className="text-muted-foreground">Last signed in</dt>
        <dd>{user.lastSignedInAt}</dd>
      </dl>
      <p className="text-sm text-muted-foreground">This view was recorded in the audit log.</p>
    </main>
  );
}
