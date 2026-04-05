import type { ColumnDef } from '@tanstack/react-table';
import dayjs from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime';
import { AlertCircle, Check, Clock, ExternalLink, Play, SkipForward } from 'lucide-react';
import { useMemo } from 'react';
import type { MetaFunction } from 'react-router';
import { Form, Link, data, useLoaderData, useNavigation, useSearchParams } from 'react-router';
import { createServerClient } from '~/api.server';
import { DataTable } from '~/components/data-table';
import { Badge } from '~/components/ui/badge';
import { Button } from '~/components/ui/button';
import { requireModerator } from '~/lib/auth.server';

dayjs.extend(relativeTime);

type ProcessingStatus = 'pending' | 'processed' | 'skipped' | 'failed';

interface CrawlPost {
  platform: string;
  platformPostId: string;
  entityType: string;
  entityId: string;
  handle: string;
  postUrl: string;
  postedAt: string;
  processingStatus: string;
  processedAt?: string;
  errorMessage?: string;
  extractedEventId?: string;
}

interface StatusStats {
  count: number;
  hasMore: boolean;
}

export const meta: MetaFunction = () => {
  return [{ name: 'robots', content: 'noindex, nofollow' }];
};

export async function loader({ request }: { request: Request }) {
  await requireModerator(request);

  const url = new URL(request.url);
  const status = (url.searchParams.get('status') ?? 'failed') as ProcessingStatus;

  const serverClient = await createServerClient(request);
  const [stats, postsResult] = await Promise.all([
    serverClient.crawl.getStats.query(),
    serverClient.crawl.listPosts.query({ status, limit: 100 }),
  ]);

  return data({
    stats: stats as Record<ProcessingStatus, StatusStats>,
    posts: postsResult.items as CrawlPost[],
    hasMore: postsResult.hasMore,
    activeStatus: status,
  });
}

export async function action({ request }: { request: Request }) {
  await requireModerator(request);

  const serverClient = await createServerClient(request);
  const formData = await request.formData();
  const entityId = formData.get('entityId') as string;
  const entityType = formData.get('entityType') as 'artist' | 'organiser' | 'venue';

  const result = await serverClient.crawl.triggerCrawl.mutate({ entityId, entityType });
  return data({ triggered: result.triggered, handle: result.handle });
}

const STATUS_CONFIG: Record<
  ProcessingStatus,
  { label: string; icon: React.ReactNode; className: string }
> = {
  pending: {
    label: 'Pending',
    icon: <Clock className="h-5 w-5" />,
    className: 'text-yellow-600 dark:text-yellow-400',
  },
  processed: {
    label: 'Processed',
    icon: <Check className="h-5 w-5" />,
    className: 'text-green-600 dark:text-green-400',
  },
  skipped: {
    label: 'Skipped',
    icon: <SkipForward className="h-5 w-5" />,
    className: 'text-muted-foreground',
  },
  failed: {
    label: 'Failed',
    icon: <AlertCircle className="h-5 w-5" />,
    className: 'text-red-600 dark:text-red-400',
  },
};

function StatusBadge({ status }: { status: string }) {
  const config = STATUS_CONFIG[status as ProcessingStatus];
  if (!config) return <Badge variant="outline">{status}</Badge>;

  const variantMap: Record<ProcessingStatus, 'default' | 'secondary' | 'destructive' | 'outline'> =
    {
      pending: 'secondary',
      processed: 'default',
      skipped: 'outline',
      failed: 'destructive',
    };

  return <Badge variant={variantMap[status as ProcessingStatus]}>{config.label}</Badge>;
}

function TriggerButton({ post }: { post: CrawlPost }) {
  const navigation = useNavigation();
  const isBusy = navigation.state !== 'idle';
  const isThisRow =
    navigation.state === 'submitting' && navigation.formData?.get('entityId') === post.entityId;

  return (
    <Form method="post">
      <input type="hidden" name="entityId" value={post.entityId} />
      <input type="hidden" name="entityType" value={post.entityType} />
      <Button
        type="submit"
        size="sm"
        variant="ghost"
        disabled={isBusy}
        title="Trigger crawl for this entity"
        className="h-7 w-7 p-0"
      >
        {isThisRow ? (
          <Clock className="h-3.5 w-3.5 animate-spin" />
        ) : (
          <Play className="h-3.5 w-3.5" />
        )}
      </Button>
    </Form>
  );
}

export default function ModeratorCrawlStatus() {
  const { stats, posts, hasMore, activeStatus } = useLoaderData<typeof loader>();
  const [searchParams, setSearchParams] = useSearchParams();

  const STATUSES: ProcessingStatus[] = ['pending', 'processed', 'skipped', 'failed'];

  const columns = useMemo<ColumnDef<CrawlPost>[]>(
    () => [
      {
        accessorKey: 'handle',
        header: 'Handle',
        cell: ({ row }) => (
          <span className="text-sm font-mono font-medium">@{row.getValue('handle')}</span>
        ),
      },
      {
        accessorKey: 'entityType',
        header: 'Entity',
        cell: ({ row }) => (
          <span className="text-sm capitalize text-muted-foreground">
            {row.getValue('entityType')}
          </span>
        ),
      },
      {
        accessorKey: 'postedAt',
        header: 'Posted',
        cell: ({ row }) => (
          <span className="text-sm text-muted-foreground">
            {dayjs(row.getValue('postedAt')).fromNow()}
          </span>
        ),
      },
      {
        accessorKey: 'processingStatus',
        header: 'Status',
        cell: ({ row }) => <StatusBadge status={row.getValue('processingStatus')} />,
      },
      {
        accessorKey: 'processedAt',
        header: 'Processed',
        cell: ({ row }) => {
          const val = row.getValue('processedAt') as string | undefined;
          return (
            <span className="text-sm text-muted-foreground">
              {val ? dayjs(val).fromNow() : '—'}
            </span>
          );
        },
      },
      {
        accessorKey: 'errorMessage',
        header: 'Error',
        cell: ({ row }) => {
          const msg = row.original.errorMessage;
          return msg ? (
            <span
              className="text-xs text-red-600 dark:text-red-400 max-w-[240px] truncate block"
              title={msg}
            >
              {msg}
            </span>
          ) : (
            <span className="text-muted-foreground">—</span>
          );
        },
      },
      {
        id: 'actions',
        header: '',
        cell: ({ row }) => (
          <div className="flex items-center gap-1">
            <TriggerButton post={row.original} />
            <a
              href={row.original.postUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-muted-foreground hover:text-foreground p-1"
              title="View Instagram post"
            >
              <ExternalLink className="h-3.5 w-3.5" />
            </a>
            {row.original.extractedEventId && (
              <Link
                to={`/events/${row.original.extractedEventId}`}
                className="text-xs text-blue-600 dark:text-blue-400 hover:underline"
              >
                Event
              </Link>
            )}
          </div>
        ),
      },
    ],
    []
  );

  const handleStatusChange = (status: ProcessingStatus) => {
    setSearchParams(prev => {
      prev.set('status', status);
      prev.delete('nextToken');
      return prev;
    });
  };

  return (
    <div className="max-w-6xl mx-auto px-4 py-8">
      <h1 className="text-2xl font-bold text-foreground mb-6">Instagram Crawl Status</h1>

      {/* Stats cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-8">
        {STATUSES.map(status => {
          const config = STATUS_CONFIG[status];
          const stat = stats[status];
          const isActive = activeStatus === status;
          return (
            <button
              key={status}
              type="button"
              onClick={() => handleStatusChange(status)}
              className={`rounded-lg border p-4 text-left transition-colors hover:bg-accent ${
                isActive ? 'border-primary bg-accent' : 'bg-card'
              }`}
            >
              <div className={`mb-2 ${config.className}`}>{config.icon}</div>
              <div className="text-2xl font-bold text-foreground">
                {stat.count}
                {stat.hasMore && '+'}
              </div>
              <div className="text-sm text-muted-foreground">{config.label}</div>
            </button>
          );
        })}
      </div>

      {/* Posts table */}
      <div className="bg-card rounded-lg border">
        <div className="px-4 py-3 border-b flex items-center gap-2">
          <StatusBadge status={activeStatus} />
          <span className="text-sm text-muted-foreground">posts, newest first</span>
        </div>
        {posts.length === 0 ? (
          <div className="p-8 text-center text-muted-foreground">
            No {activeStatus} posts found.
          </div>
        ) : (
          <DataTable columns={columns} data={posts} />
        )}
      </div>

      {hasMore && (
        <p className="mt-4 text-center text-sm text-muted-foreground">
          Showing first 100 results. Use filters to narrow down.
        </p>
      )}
    </div>
  );
}
