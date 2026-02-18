import {
  type Edit,
  EditEntityTypes,
  EditStatus,
  computeEditDiff,
  formatValue,
} from '@rasika/core/domain/edit/client';
import type { ColumnDef } from '@tanstack/react-table';
import dayjs from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime';
import { Check, Clock, Eye, X } from 'lucide-react';
import { useMemo } from 'react';
import type { ActionFunction, LoaderFunction } from 'react-router';
import { Form, data, useFetcher, useLoaderData } from 'react-router';
import { createServerClient } from '~/api.server';
import { DataTable } from '~/components/data-table';
import { Button } from '~/components/ui/button';
import { Input } from '~/components/ui/input';
import { Label } from '~/components/ui/label';
import { requireModerator } from '~/lib/auth.server';

dayjs.extend(relativeTime);

interface EditWithDiff extends Edit {
  diff: Array<{ field: string; oldValue: unknown; newValue: unknown }>;
}

export async function loader({ request }: { request: Request }) {
  const user = await requireModerator(request);

  const url = new URL(request.url);
  const nextToken = url.searchParams.get('nextToken') ?? undefined;

  const serverClient = await createServerClient(request);
  const result = await serverClient.edit.getPendingEdits.query({ nextToken });

  const enrichedEdits = await Promise.all(
    result.items.map(async edit => {
      try {
        let currentEntity: Record<string, unknown> = {};

        switch (edit.entityType) {
          case 'composition': {
            const composition = await serverClient.composition.get.query({ id: edit.entityId });
            currentEntity = composition as unknown as Record<string, unknown>;
            break;
          }
          case 'artist': {
            const artist = await serverClient.artist.get.query({ id: edit.entityId });
            currentEntity = artist as unknown as Record<string, unknown>;
            break;
          }
          case 'raga': {
            const raga = await serverClient.raga.get.query({ id: edit.entityId });
            currentEntity = raga as unknown as Record<string, unknown>;
            break;
          }
          case 'tala': {
            const tala = await serverClient.tala.get.query({ id: edit.entityId });
            currentEntity = tala as unknown as Record<string, unknown>;
            break;
          }
        }

        // Enrich proposedValues with raga/tala names for better diff display
        const enrichedProposedValues = { ...edit.proposedValues };

        if (edit.entityType === 'composition') {
          // Convert ragaIds to full objects for diff
          if (enrichedProposedValues.ragaIds && Array.isArray(enrichedProposedValues.ragaIds)) {
            const ragaIds = enrichedProposedValues.ragaIds as string[];
            const ragas = await Promise.all(
              ragaIds.map(async (id: string) => {
                const raga = await serverClient.raga.get.query({ id });
                return raga ? { id: raga.id, name: raga.name } : null;
              })
            );
            enrichedProposedValues.ragas = ragas.filter(
              (r): r is { id: string; name: string } => r !== null
            );
            enrichedProposedValues.ragaIds = undefined;
          }

          // Convert talaIds to full objects for diff
          if (enrichedProposedValues.talaIds && Array.isArray(enrichedProposedValues.talaIds)) {
            const talaIds = enrichedProposedValues.talaIds as string[];
            const talas = await Promise.all(
              talaIds.map(async (id: string) => {
                const tala = await serverClient.tala.get.query({ id });
                return tala ? { id: tala.id, name: tala.name } : null;
              })
            );
            enrichedProposedValues.talas = talas.filter(
              (t): t is { id: string; name: string } => t !== null
            );
            enrichedProposedValues.talaIds = undefined;
          }
        }

        const diff = computeEditDiff(currentEntity, enrichedProposedValues);
        return { ...edit, diff } as EditWithDiff;
      } catch (error) {
        console.error(`Failed to compute diff for edit ${edit.id}:`, error);
        return { ...edit, diff: [] } as EditWithDiff;
      }
    })
  );

  return data({
    edits: enrichedEdits,
    nextToken: result.nextToken,
    hasMore: result.hasMore,
    userRole: user.role,
    error: null as string | null,
  });
}

export async function action({ request }: { request: Request }) {
  await requireModerator(request);

  const serverClient = await createServerClient(request);
  const formData = await request.formData();
  const intent = formData.get('intent') as string;
  const editId = formData.get('editId') as string;

  if (intent === 'approve') {
    await serverClient.edit.approve.mutate({ editId });
  } else if (intent === 'reject') {
    const moderatorNote = formData.get('moderatorNote') as string;
    await serverClient.edit.reject.mutate({ editId, moderatorNote });
  }

  return data({ success: true });
}

function entityPath(entityType: string, entityId: string) {
  switch (entityType) {
    case 'composition':
      return `/carnatic/compositions/${entityId}`;
    case 'artist':
      return `/artists/${entityId}`;
    case 'raga':
      return `/carnatic/ragas/${entityId}`;
    case 'tala':
      return `/carnatic/talas/${entityId}`;
    default:
      return '#';
  }
}

function statusBadge(status: string) {
  const colors: Record<string, string> = {
    draft: 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200',
    submitted: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200',
    approved: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
    rejected: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200',
    withdrawn: 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200',
  };

  return (
    <span
      className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${colors[status] || 'bg-gray-100 text-gray-800'}`}
    >
      {status.charAt(0).toUpperCase() + status.slice(1)}
    </span>
  );
}

function EditActions({ edit }: { edit: EditWithDiff }) {
  const fetcher = useFetcher();
  const isSubmitting = fetcher.state === 'submitting';

  return (
    <Form method="post" className="flex items-center justify-end gap-2">
      <input type="hidden" name="editId" value={edit.id} />
      <Button
        type="submit"
        name="intent"
        value="approve"
        disabled={isSubmitting}
        size="sm"
        className="bg-green-600 hover:bg-green-700"
      >
        <Check className="h-4 w-4" />
      </Button>
      <div className="flex items-center gap-1">
        <Label htmlFor={`note-${edit.id}`} className="sr-only">
          Rejection reason
        </Label>
        <Input
          id={`note-${edit.id}`}
          name="moderatorNote"
          placeholder="Reject reason"
          className="h-8 w-32 text-xs"
        />
        <Button
          type="submit"
          name="intent"
          value="reject"
          disabled={isSubmitting}
          size="sm"
          variant="destructive"
        >
          <X className="h-4 w-4" />
        </Button>
      </div>
    </Form>
  );
}

export default function ModeratorEdits() {
  const { edits, userRole, error } = useLoaderData<typeof loader>();

  const columns = useMemo<ColumnDef<EditWithDiff>[]>(
    () => [
      {
        accessorKey: 'entityType',
        header: 'Entity',
        cell: ({ row }) => (
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-foreground capitalize">
              {row.getValue('entityType')}
            </span>
            <a
              href={entityPath(row.original.entityType, row.original.entityId)}
              target="_blank"
              rel="noopener noreferrer"
              className="text-muted-foreground hover:text-foreground"
              title="View entity"
            >
              <Eye className="h-4 w-4" />
            </a>
          </div>
        ),
      },
      {
        accessorKey: 'status',
        header: 'Status',
        cell: ({ row }) => statusBadge(row.getValue('status')),
      },
      {
        accessorKey: 'submittedAt',
        header: 'Submitted',
        cell: ({ row }) => (
          <span className="text-sm text-muted-foreground">
            {dayjs(row.getValue('submittedAt') || row.original.createdAt).fromNow()}
          </span>
        ),
      },
      {
        id: 'changes',
        header: 'Proposed Changes',
        cell: ({ row }) => {
          const diff = row.original.diff;
          return (
            <div className="text-xs space-y-1 max-w-md">
              {diff && diff.length > 0 ? (
                diff.map(change => (
                  <div key={change.field} className="bg-muted rounded p-2">
                    <div className="font-medium text-foreground mb-1">{change.field}</div>
                    <div className="flex items-center gap-2">
                      <span className="text-red-600 dark:text-red-400 line-through">
                        {formatValue(change.oldValue)}
                      </span>
                      <span className="text-muted-foreground">→</span>
                      <span className="text-green-600 dark:text-green-400">
                        {formatValue(change.newValue)}
                      </span>
                    </div>
                  </div>
                ))
              ) : (
                <span className="text-muted-foreground">No changes</span>
              )}
            </div>
          );
        },
      },
      {
        accessorKey: 'userNote',
        header: 'User Note',
        cell: ({ row }) => {
          const note = row.getValue('userNote') as string | null | undefined;
          return note ? (
            <p className="text-sm text-foreground bg-muted rounded p-2 max-w-xs">{note}</p>
          ) : (
            <span className="text-muted-foreground text-sm">-</span>
          );
        },
      },
      {
        id: 'actions',
        header: 'Actions',
        cell: ({ row }) => <EditActions edit={row.original} />,
      },
    ],
    []
  );

  if (error) {
    return (
      <div className="max-w-6xl mx-auto px-4 py-8">
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 dark:bg-red-950 dark:border-red-800">
          <p className="text-red-800 dark:text-red-200">{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto px-4 py-8">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-foreground">Pending Edits</h1>
        <span className="text-sm text-muted-foreground">Moderator: {userRole}</span>
      </div>

      {edits.length === 0 ? (
        <div className="bg-card rounded-lg shadow-sm border p-8 text-center">
          <Clock className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
          <h2 className="text-lg font-medium text-foreground mb-2">All caught up!</h2>
          <p className="text-muted-foreground">
            No pending edits to review. New submissions will appear here.
          </p>
        </div>
      ) : (
        <DataTable columns={columns} data={edits} />
      )}
    </div>
  );
}
