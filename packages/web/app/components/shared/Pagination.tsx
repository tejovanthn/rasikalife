import { Link } from 'react-router';
import { buttonVariants } from '~/components/ui/button';

interface PaginationProps {
  hasMore: boolean;
  nextToken?: string;
  searchParams: URLSearchParams;
  className?: string;
  loadMoreText?: string;
}

export function Pagination({
  hasMore,
  nextToken,
  searchParams,
  className = '',
  loadMoreText = 'Load More',
}: PaginationProps) {
  if (!hasMore) return null;

  const nextPageParams = new URLSearchParams(searchParams);
  if (nextToken) {
    nextPageParams.set('token', nextToken);
    const currentPage = Number.parseInt(searchParams.get('page') || '1');
    nextPageParams.set('page', (currentPage + 1).toString());
  }

  return (
    <div className={`flex justify-center mt-8 ${className}`}>
      <Link to={`?${nextPageParams.toString()}`} className={buttonVariants({ size: 'lg' })}>
        {loadMoreText}
      </Link>
    </div>
  );
}
