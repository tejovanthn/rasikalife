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
            <PaginationLink to={baseUrl} isActive={currentPage === 1}>
              1
            </PaginationLink>
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
              <PaginationNext
                to={`${baseUrl}?page=${currentPage + 1}&nextToken=${encodeURIComponent(nextToken || '')}`}
              />
            </PaginationItem>
          )}
        </PaginationContent>
      </Pagination>
    </div>
  );
}
