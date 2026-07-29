import type { ColumnDef } from '@tanstack/react-table';
import dayjs from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime';
import { useMemo } from 'react';
import type { MetaFunction } from 'react-router';
import { data, useFetcher, useLoaderData } from 'react-router';
import { createServerClient } from '~/api.server';
import { DataTable } from '~/components/data-table';
import { Badge } from '~/components/ui/badge';
import { Button } from '~/components/ui/button';
import { requireAdmin } from '~/lib/auth.server';

dayjs.extend(relativeTime);

interface UserRow {
  id: string;
  name: string;
  email: string;
  picture?: string;
  role: string;
  lastSignedInAt: string;
}

export const meta: MetaFunction = () => {
  return [{ name: 'robots', content: 'noindex, nofollow' }];
};

export async function loader({ request }: { request: Request }) {
  await requireAdmin(request);
  const serverClient = await createServerClient(request);
  const users = await serverClient.user.list.query();
  return data({ users: users as UserRow[] });
}

export async function action({ request }: { request: Request }) {
  await requireAdmin(request);
  const serverClient = await createServerClient(request);
  const formData = await request.formData();
  const userId = formData.get('userId') as string;
  const role = formData.get('role') as 'editor' | 'moderator' | 'admin';
  await serverClient.user.updateRole.mutate({ userId, role });
  return data({ success: true });
}

const ROLE_VALUES = ['editor', 'moderator', 'admin'] as const;

const roleBadgeVariant: Record<string, 'default' | 'secondary' | 'destructive'> = {
  admin: 'destructive',
  moderator: 'default',
  editor: 'secondary',
};

function RoleCell({ user }: { user: UserRow }) {
  const fetcher = useFetcher();
  const pendingRole = fetcher.formData?.get('role') as string | undefined;
  const currentRole = pendingRole ?? user.role;

  return (
    <fetcher.Form method="post" className="flex items-center gap-2">
      <input type="hidden" name="userId" value={user.id} />
      <select
        name="role"
        defaultValue={user.role}
        // One select per table row — see DESIGN.md density rule.
        aria-label={`Role for ${user.name}`}
        className="text-sm border rounded px-2 py-1 bg-background"
        onChange={e => {
          // track local state via form default value
          e.currentTarget.form?.setAttribute(
            'data-dirty',
            String(e.currentTarget.value !== user.role)
          );
        }}
      >
        {ROLE_VALUES.map(r => (
          <option key={r} value={r}>
            {r}
          </option>
        ))}
      </select>
      <Button type="submit" size="sm" variant="outline" disabled={fetcher.state !== 'idle'}>
        Save
      </Button>
    </fetcher.Form>
  );
}

export default function ModeratorUsers() {
  const { users } = useLoaderData<typeof loader>();

  const columns = useMemo<ColumnDef<UserRow>[]>(
    () => [
      {
        id: 'name',
        header: 'Name',
        cell: ({ row }) => (
          <div className="flex items-center gap-2">
            {row.original.picture ? (
              <img
                src={row.original.picture}
                alt={row.original.name}
                className="h-7 w-7 rounded-full"
                loading="lazy"
                decoding="async"
              />
            ) : null}
            <span className="text-sm font-medium">{row.original.name}</span>
          </div>
        ),
      },
      {
        accessorKey: 'email',
        header: 'Email',
        cell: ({ row }) => (
          <span className="text-sm text-muted-foreground">{row.getValue('email')}</span>
        ),
      },
      {
        id: 'currentRole',
        header: 'Current Role',
        cell: ({ row }) => (
          <Badge variant={roleBadgeVariant[row.original.role] ?? 'secondary'}>
            {row.original.role}
          </Badge>
        ),
      },
      {
        id: 'changeRole',
        header: 'Change Role',
        cell: ({ row }) => <RoleCell user={row.original} />,
      },
      {
        id: 'lastSignedIn',
        header: 'Last Signed In',
        cell: ({ row }) => (
          <span className="text-sm text-muted-foreground">
            {row.original.lastSignedInAt ? dayjs(row.original.lastSignedInAt).fromNow() : '-'}
          </span>
        ),
      },
    ],
    []
  );

  return (
    <div className="max-w-6xl mx-auto px-4 py-8">
      <h1 className="text-2xl font-bold text-foreground mb-6">Manage Users</h1>
      <DataTable columns={columns} data={users} />
    </div>
  );
}
