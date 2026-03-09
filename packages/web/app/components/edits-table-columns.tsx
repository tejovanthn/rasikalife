import { type Edit, EditStatus } from '@rasika/core/domain/edit/client';
import type { ColumnDef } from '@tanstack/react-table';
import dayjs from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime';
import { ArrowUpDown, Eye } from 'lucide-react';
import { Link } from 'react-router';
import { Button } from '~/components/ui/button';

dayjs.extend(relativeTime);

// Extended type for table display that may include additional properties
type EditWithDisplay = Edit & {
  entitySlug?: string;
  entityName?: string;
};

function entityPath(entityType: string, entityId: string, editStatus: string): string {
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
      if (editStatus === EditStatus.DRAFT || editStatus === EditStatus.SUBMITTED) {
        return `/events/new/verify?eventId=${entityId}`;
      }
      return `/events/${entityId}`;
    default:
      return '#';
  }
}

function statusIcon(status: string) {
  const colors: Record<string, string> = {
    draft: 'text-gray-500',
    submitted: 'text-yellow-500',
    approved: 'text-green-500',
    rejected: 'text-red-500',
    withdrawn: 'text-gray-400',
  };

  return (
    <span className={`inline-flex items-center gap-2 ${colors[status] || colors.draft}`}>
      <span className="w-2 h-2 rounded-full bg-current" />
      <span className="capitalize">{status}</span>
    </span>
  );
}

export function createColumns(onViewEdit: (edit: Edit) => void): ColumnDef<EditWithDisplay>[] {
  return [
    {
      accessorKey: 'entityType',
      header: 'Type',
      cell: ({ row }) => (
        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-muted text-foreground capitalize">
          {row.getValue('entityType')}
        </span>
      ),
    },
    {
      accessorKey: 'entityName',
      header: 'Entity',
      cell: ({ row }) => {
        const entityType = row.original.entityType;
        const entitySlug = row.original.entitySlug || row.original.entityId;
        const entityName = (row.getValue('entityName') as string) || 'Unknown';
        return (
          <Link
            to={entityPath(entityType, entitySlug, row.original.status)}
            className="text-sm font-medium text-primary hover:text-primary/80 hover:underline"
          >
            {entityName}
          </Link>
        );
      },
    },
    {
      accessorKey: 'status',
      header: ({ column }) => {
        return (
          <Button
            variant="ghost"
            onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}
          >
            Status
            <ArrowUpDown className="ml-2 h-4 w-4" />
          </Button>
        );
      },
      cell: ({ row }) => statusIcon(row.getValue('status')),
      filterFn: (row, id, value) => {
        return value.includes(row.getValue(id));
      },
    },
    {
      accessorKey: 'createdAt',
      header: ({ column }) => {
        return (
          <Button
            variant="ghost"
            onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}
          >
            Created
            <ArrowUpDown className="ml-2 h-4 w-4" />
          </Button>
        );
      },
      cell: ({ row }) => {
        return (
          <span className="text-sm text-muted-foreground">
            {dayjs(row.getValue('createdAt')).fromNow()}
          </span>
        );
      },
    },
    {
      id: 'actions',
      header: 'Actions',
      cell: ({ row }) => {
        const edit = row.original;

        return (
          <div className="flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={() => onViewEdit(edit)}
              className="text-muted-foreground hover:text-foreground inline-flex items-center gap-1 p-2"
              title="View details"
            >
              <Eye className="h-4 w-4" />
            </button>
          </div>
        );
      },
    },
  ];
}
