import {
  type Edit,
  EditStatus,
  computeEditDiff,
  formatValue,
} from '@rasika/core/domain/edit/client';
import dayjs from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime';
import { Check, Clock, Edit2, Loader2, X } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { useFetcher } from 'react-router';
import type { ActionFunction, LoaderFunction, MetaFunction } from 'react-router';
import { Link, data, useLoaderData, useSearchParams } from 'react-router';
import { toast } from 'sonner';
import { createServerClient } from '~/api.server';
import { DataTable } from '~/components/data-table';
import { createColumns } from '~/components/edits-table-columns';
import { Button } from '~/components/ui/button';
import { requireUser } from '~/lib/auth.server';

dayjs.extend(relativeTime);

interface EditWithDiff extends Edit {
  diff: Array<{ field: string; oldValue: unknown; newValue: unknown }>;
  entityName: string;
  entitySlug: string;
}

export const meta: MetaFunction = () => {
  return [{ name: 'robots', content: 'noindex, nofollow' }];
};

export async function loader({ request }: { request: Request }) {
  const user = await requireUser(request, new URL(request.url).pathname);

  const url = new URL(request.url);
  const nextToken = url.searchParams.get('nextToken') ?? undefined;

  const serverClient = await createServerClient(request);
  const result = await serverClient.edit.getUserEdits.query({ nextToken });

  // Enrich edits with diff data
  const enrichedEdits = await Promise.all(
    result.items.map(async edit => {
      try {
        let currentEntity: Record<string, unknown> = {};

        // Fetch current entity based on type
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
          case 'venue': {
            const venue = await serverClient.venue.get.query({ id: edit.entityId });
            currentEntity = venue as unknown as Record<string, unknown>;
            break;
          }
          case 'organiser': {
            const organiser = await serverClient.organiser.get.query({ id: edit.entityId });
            currentEntity = organiser as unknown as Record<string, unknown>;
            break;
          }
          case 'event': {
            const event = await serverClient.event.get.query({ id: edit.entityId });
            currentEntity = event as unknown as Record<string, unknown>;
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

        // For delete operations, skip diff computation
        if (edit.operation === 'delete') {
          let entityName = 'Unknown';
          let entitySlug = edit.entityId;
          if (currentEntity.title) {
            entityName = currentEntity.title as string;
          } else if (currentEntity.name) {
            entityName = currentEntity.name as string;
          }
          if (currentEntity.slug) {
            entitySlug = currentEntity.slug as string;
          }
          return { ...edit, diff: [], entityName, entitySlug } as EditWithDiff;
        }

        const diff = computeEditDiff(currentEntity, enrichedProposedValues);

        // Extract entity name and slug for display
        let entityName = 'Unknown';
        let entitySlug = edit.entityId;

        if (currentEntity.title) {
          entityName = currentEntity.title as string;
        } else if (currentEntity.name) {
          entityName = currentEntity.name as string;
        }

        if (currentEntity.slug) {
          entitySlug = currentEntity.slug as string;
        }

        return { ...edit, diff, entityName, entitySlug } as EditWithDiff;
      } catch (error) {
        console.error(`Failed to compute diff for edit ${edit.id}:`, error);
        return {
          ...edit,
          diff: [],
          entityName: 'Unknown',
          entitySlug: edit.entityId,
        } as EditWithDiff;
      }
    })
  );

  return data({ edits: enrichedEdits, nextToken: result.nextToken, hasMore: result.hasMore });
}

export async function action({ request }: { request: Request }) {
  const user = await requireUser(request, new URL(request.url).pathname);

  const formData = await request.formData();
  const intent = formData.get('intent') as string;
  const editId = formData.get('editId') as string;

  const serverClient = await createServerClient(request);

  try {
    if (intent === 'submit') {
      await serverClient.edit.submit.mutate({ editId });
      return data({ success: true, message: 'Edit submitted for review!' });
    }

    if (intent === 'withdraw') {
      await serverClient.edit.withdraw.mutate({ editId });
      return data({ success: true, message: 'Edit withdrawn successfully!' });
    }

    return data({ error: 'Invalid action' }, { status: 400 });
  } catch (error) {
    console.error(`Failed to ${intent} edit:`, error);
    return data({ error: `Failed to ${intent} edit` }, { status: 500 });
  }
}

function statusIcon(status: string) {
  switch (status) {
    case EditStatus.DRAFT:
      return <Edit2 className="h-4 w-4 text-muted-foreground" />;
    case EditStatus.SUBMITTED:
      return <Clock className="h-4 w-4 text-warning" />;
    case EditStatus.APPROVED:
      return <Check className="h-4 w-4 text-success" />;
    case EditStatus.REJECTED:
      return <X className="h-4 w-4 text-destructive" />;
    case EditStatus.WITHDRAWN:
      return <X className="h-4 w-4 text-muted-foreground" />;
    default:
      return null;
  }
}

function statusLabel(status: string) {
  return status.charAt(0).toUpperCase() + status.slice(1);
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
    case 'venue':
      return `/venues/${entityId}`;
    case 'organiser':
      return `/organisers/${entityId}`;
    case 'event':
      return `/events/${entityId}`;
    default:
      return '#';
  }
}

function EditModal({
  edit,
  onClose,
}: {
  edit: Edit;
  onClose: () => void;
}) {
  const submitFetcher = useFetcher();
  const withdrawFetcher = useFetcher();
  const isSubmitting = submitFetcher.state === 'submitting';
  const isWithdrawing = withdrawFetcher.state === 'submitting';

  const canSubmit = edit.status === EditStatus.DRAFT;
  const canWithdraw = edit.status === EditStatus.DRAFT || edit.status === EditStatus.SUBMITTED;

  const handleSubmit = () => {
    submitFetcher.submit({ intent: 'submit', editId: edit.id }, { method: 'post' });
  };

  const handleWithdraw = () => {
    if (confirm('Are you sure you want to withdraw this edit? This cannot be undone.')) {
      withdrawFetcher.submit({ intent: 'withdraw', editId: edit.id }, { method: 'post' });
    }
  };

  // Close modal and show toast when submission or withdrawal is successful
  useEffect(() => {
    const submitData = submitFetcher.data as { success?: boolean; message?: string } | undefined;
    const withdrawData = withdrawFetcher.data as
      | { success?: boolean; message?: string }
      | undefined;

    if (submitData?.success && submitFetcher.state === 'idle') {
      onClose();
      toast.success(submitData.message || 'Edit submitted for review!');
    }

    if (withdrawData?.success && withdrawFetcher.state === 'idle') {
      onClose();
      toast.success(withdrawData.message || 'Edit withdrawn successfully!');
    }
  }, [
    submitFetcher.data,
    submitFetcher.state,
    withdrawFetcher.data,
    withdrawFetcher.state,
    onClose,
  ]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
      onClick={onClose}
      onKeyDown={e => e.key === 'Escape' && onClose()}
    >
      <div
        className="bg-card rounded-lg shadow-lg max-w-2xl w-full mx-4 max-h-[80vh] overflow-auto"
        onClick={e => e.stopPropagation()}
        onKeyDown={e => e.stopPropagation()}
      >
        <div className="sticky top-0 bg-card border-b px-6 py-4 flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold capitalize">Edit Details</h2>
            <p className="text-sm text-muted-foreground capitalize">
              {edit.entityType} edit • {statusLabel(edit.status)}
            </p>
          </div>
          <Button
            variant="ghost"
            size="icon"
            type="button"
            onClick={onClose}
            aria-label="Close dialog"
          >
            <X className="h-5 w-5" />
          </Button>
        </div>

        <div className="p-6 space-y-6">
          <div>
            <h3 className="text-sm font-medium mb-2">Proposed Changes</h3>
            <div className="space-y-2">
              {edit.operation === 'delete' ? (
                <div className="bg-destructive/10 rounded p-4 text-sm text-foreground text-center font-medium">
                  This is a deletion request
                </div>
              ) : (edit as EditWithDiff).diff && (edit as EditWithDiff).diff.length > 0 ? (
                (edit as EditWithDiff).diff.map(change => (
                  <div key={change.field} className="bg-muted rounded p-3">
                    <div className="font-medium text-foreground mb-1.5">{change.field}</div>
                    <div className="flex items-start gap-2 text-sm">
                      <span className="text-destructive line-through flex-1 break-words">
                        {formatValue(change.oldValue)}
                      </span>
                      <span className="text-muted-foreground shrink-0">→</span>
                      <span className="text-success flex-1 break-words">
                        {formatValue(change.newValue)}
                      </span>
                    </div>
                  </div>
                ))
              ) : (
                <div className="bg-muted rounded p-4 text-sm text-muted-foreground text-center">
                  No changes detected
                </div>
              )}
            </div>
          </div>

          {edit.userNote && (
            <div>
              <h3 className="text-sm font-medium mb-2">Your Note</h3>
              <p className="text-sm bg-muted rounded p-3">{edit.userNote}</p>
            </div>
          )}

          {edit.moderatorNote && (
            <div>
              <h3 className="text-sm font-medium mb-2">
                {edit.status === EditStatus.REJECTED ? 'Rejection Reason' : 'Moderator Note'}
              </h3>
              <p
                className={`text-sm rounded p-3 ${
                  edit.status === EditStatus.REJECTED
                    ? 'bg-destructive/10 text-foreground'
                    : 'bg-muted'
                }`}
              >
                {edit.moderatorNote}
              </p>
            </div>
          )}

          <div className="flex items-center justify-between text-sm text-muted-foreground">
            <span>Created {dayjs(edit.createdAt).fromNow()}</span>
            {edit.submittedAt && <span>Submitted {dayjs(edit.submittedAt).fromNow()}</span>}
          </div>
        </div>

        <div className="sticky bottom-0 bg-card border-t px-6 py-4 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            {canWithdraw && (
              <Button
                variant="outline"
                onClick={handleWithdraw}
                disabled={isWithdrawing}
                className="text-destructive hover:text-destructive/90 hover:bg-destructive/10"
              >
                {isWithdrawing ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Withdrawing...
                  </>
                ) : (
                  <>
                    <X className="mr-2 h-4 w-4" />
                    Withdraw Edit
                  </>
                )}
              </Button>
            )}
          </div>
          <div className="flex items-center gap-3">
            <Button variant="outline" onClick={onClose}>
              Close
            </Button>
            {canSubmit && (
              <Button onClick={handleSubmit} disabled={isSubmitting} className="min-w-[120px]">
                {isSubmitting ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Submitting...
                  </>
                ) : (
                  <>
                    <Check className="mr-2 h-4 w-4" />
                    Submit for Review
                  </>
                )}
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default function MyEdits() {
  const { edits, nextToken, hasMore } = useLoaderData<typeof loader>();
  const [searchParams, setSearchParams] = useSearchParams();
  const [selectedEdit, setSelectedEdit] = useState<Edit | null>(null);

  const columns = useMemo(() => createColumns(setSelectedEdit), []);

  const statusFilter = searchParams.get('status');
  const editIdParam = searchParams.get('editId');

  // Auto-open modal if editId is in URL
  useEffect(() => {
    if (editIdParam && !selectedEdit) {
      const edit = edits.find(e => e.id === editIdParam);
      if (edit) {
        setSelectedEdit(edit);
      }
    }
  }, [editIdParam, edits, selectedEdit]);

  const filteredEdits = useMemo(() => {
    if (!statusFilter || statusFilter === 'all') return edits;
    return edits.filter(edit => edit.status === statusFilter);
  }, [edits, statusFilter]);

  if (edits.length === 0) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-8">
        <h1 className="text-2xl font-bold text-foreground mb-6">My Edits</h1>
        <div className="bg-card rounded-lg shadow-sm border p-8 text-center">
          <Edit2 className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
          <h2 className="text-lg font-medium text-foreground mb-2">No edits yet</h2>
          <p className="text-muted-foreground mb-4">
            You haven&apos;t submitted any edits. Start by editing a composition, artist, raga, or
            tala.
          </p>
          <Button asChild>
            <Link to="/carnatic/compositions">Browse Compositions</Link>
          </Button>
        </div>
      </div>
    );
  }

  const statusCounts = useMemo(
    () => ({
      all: edits.length,
      draft: edits.filter(e => e.status === EditStatus.DRAFT).length,
      submitted: edits.filter(e => e.status === EditStatus.SUBMITTED).length,
      approved: edits.filter(e => e.status === EditStatus.APPROVED).length,
      rejected: edits.filter(e => e.status === EditStatus.REJECTED).length,
      withdrawn: edits.filter(e => e.status === EditStatus.WITHDRAWN).length,
    }),
    [edits]
  );

  const handleCloseModal = () => {
    setSelectedEdit(null);
    // Remove editId from URL if present
    if (editIdParam) {
      const newParams = new URLSearchParams(searchParams);
      newParams.delete('editId');
      setSearchParams(newParams);
    }
  };

  return (
    <>
      <div className="max-w-6xl mx-auto px-4 py-8">
        <h1 className="text-2xl font-bold text-foreground mb-6">My Edits</h1>

        <div className="mb-4 flex gap-2 flex-wrap">
          <Button
            variant={!statusFilter ? 'default' : 'outline'}
            size="sm"
            onClick={() => setSearchParams({})}
          >
            All ({statusCounts.all})
          </Button>
          <Button
            variant={statusFilter === EditStatus.DRAFT ? 'default' : 'outline'}
            size="sm"
            onClick={() => setSearchParams({ status: EditStatus.DRAFT })}
          >
            Draft ({statusCounts.draft})
          </Button>
          <Button
            variant={statusFilter === EditStatus.SUBMITTED ? 'default' : 'outline'}
            size="sm"
            onClick={() => setSearchParams({ status: EditStatus.SUBMITTED })}
          >
            Submitted ({statusCounts.submitted})
          </Button>
          <Button
            variant={statusFilter === EditStatus.APPROVED ? 'default' : 'outline'}
            size="sm"
            onClick={() => setSearchParams({ status: EditStatus.APPROVED })}
          >
            Approved ({statusCounts.approved})
          </Button>
          <Button
            variant={statusFilter === EditStatus.REJECTED ? 'default' : 'outline'}
            size="sm"
            onClick={() => setSearchParams({ status: EditStatus.REJECTED })}
          >
            Rejected ({statusCounts.rejected})
          </Button>
          <Button
            variant={statusFilter === EditStatus.WITHDRAWN ? 'default' : 'outline'}
            size="sm"
            onClick={() => setSearchParams({ status: EditStatus.WITHDRAWN })}
          >
            Withdrawn ({statusCounts.withdrawn})
          </Button>
        </div>

        <DataTable columns={columns} data={filteredEdits} />
      </div>

      {selectedEdit && <EditModal edit={selectedEdit} onClose={handleCloseModal} />}
    </>
  );
}
