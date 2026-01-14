import { Link } from '@remix-run/react';
import {
  Pagination,
  PaginationContent,
  PaginationEllipsis,
  PaginationItem,
  PaginationLink,
  PaginationNext,
} from '~/components/ui/pagination';

type EntityPaginationProps = {
  currentPage: number;
  hasMore: boolean;
  nextToken: string | null;
  prevToken?: string | null;
  baseUrl?: string;
};

export function EntityPagination({
  currentPage,
  hasMore,
  nextToken,
  baseUrl = '',
}: EntityPaginationProps) {
  return (
    <div className="flex flex-col items-center space-y-4">
      <div className="text-sm text-muted-foreground">Page {currentPage}</div>
      <Pagination>
        <PaginationContent>
          <PaginationItem>
            <Link
              to={baseUrl}
              className={
                currentPage === 1
                  ? 'px-3 py-2 rounded-md bg-primary text-primary-foreground'
                  : 'px-3 py-2 rounded-md hover:bg-accent'
              }
            >
              1
            </Link>
          </PaginationItem>

          {currentPage > 2 && (
            <PaginationItem>
              <PaginationEllipsis />
            </PaginationItem>
          )}

          {currentPage > 1 && (
            <PaginationItem>
              <PaginationLink isActive>{currentPage}</PaginationLink>
            </PaginationItem>
          )}

          {hasMore && (
            <PaginationItem>
              <Link
                to={`${baseUrl}?page=${currentPage + 1}&nextToken=${encodeURIComponent(nextToken || '')}`}
              >
                <PaginationNext />
              </Link>
            </PaginationItem>
          )}
        </PaginationContent>
      </Pagination>
    </div>
  );
}
