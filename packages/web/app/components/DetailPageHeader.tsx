import type { Edit } from '@rasika/core/domain/edit/client';
import { EditStatus } from '@rasika/core/domain/edit/client';
import { Eye, Merge, MoreHorizontal, Pencil, Share2, Trash2 } from 'lucide-react';
import { Link } from 'react-router';
import { Button } from '~/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '~/components/ui/dropdown-menu';

interface DetailPageHeaderProps {
  title: string;
  subtitle: string;
  shareUrl: string;
  shareTitle: string;
  shareDescription: string;
  editUrl?: string;
  activeEdit?: Edit | null;
  requestDeletionUrl?: string;
  mergeUrl?: string;
  isModerator?: boolean;
}

export function DetailPageHeader({
  title,
  subtitle,
  shareUrl,
  shareTitle,
  shareDescription,
  editUrl,
  activeEdit,
  requestDeletionUrl,
  mergeUrl,
  isModerator,
}: DetailPageHeaderProps) {
  const handleShare = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: shareTitle,
          text: shareDescription || shareTitle,
          url: shareUrl,
        });
      } catch {
        // User cancelled share or error occurred
      }
    } else {
      try {
        await navigator.clipboard.writeText(shareUrl);
        alert('Link copied to clipboard!');
      } catch (error) {
        console.error('Failed to copy:', error);
      }
    }
  };

  const editHref =
    activeEdit?.status === EditStatus.SUBMITTED
      ? `/my-edits?editId=${activeEdit.id}`
      : editUrl ?? '';

  const editIcon =
    activeEdit?.status === EditStatus.SUBMITTED ? (
      <Eye className="h-4 w-4" />
    ) : (
      <Pencil className="h-4 w-4" />
    );

  const editLabel =
    activeEdit?.status === EditStatus.DRAFT
      ? 'Continue editing'
      : activeEdit?.status === EditStatus.SUBMITTED
        ? 'View edit status'
        : 'Edit';

  return (
    <header className="mb-8">
      <div className="flex items-center gap-3 mb-2">
        <h1 className="text-3xl md:text-4xl font-bold">{title}</h1>

        {/* Desktop action buttons — hidden on mobile */}
        <div className="hidden md:flex items-center gap-2 ml-auto shrink-0">
          {editUrl && (
            <Button asChild variant="secondary" size="sm">
              <Link to={editHref}>
                {editIcon}
                {editLabel}
              </Link>
            </Button>
          )}
          <Button variant="outline" size="sm" onClick={handleShare} className="flex items-center gap-2">
            <Share2 className="h-4 w-4" />
            Share
          </Button>
          {isModerator && (mergeUrl || requestDeletionUrl) && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" aria-label="More actions">
                  <MoreHorizontal className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                {mergeUrl && (
                  <DropdownMenuItem asChild>
                    <Link to={mergeUrl}>
                      <Merge className="h-4 w-4 mr-2" />
                      Merge
                    </Link>
                  </DropdownMenuItem>
                )}
                {requestDeletionUrl && (
                  <DropdownMenuItem asChild className="text-destructive focus:text-destructive">
                    <Link to={requestDeletionUrl}>
                      <Trash2 className="h-4 w-4 mr-2" />
                      Delete
                    </Link>
                  </DropdownMenuItem>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>
      </div>
      <p className="text-lg text-muted-foreground">{subtitle}</p>

      {/* Mobile speed-dial FABs — visible only on mobile */}
      <div className="md:hidden fixed bottom-6 right-6 flex flex-col items-center gap-3 z-40">
        {/* More (moderator only) — same size as Share, topmost */}
        {isModerator && (mergeUrl || requestDeletionUrl) && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                size="icon"
                variant="secondary"
                className="h-10 w-10 rounded-full shadow-md"
                aria-label="More actions"
              >
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" side="top" className="mb-2">
              {mergeUrl && (
                <DropdownMenuItem asChild>
                  <Link to={mergeUrl}>
                    <Merge className="h-4 w-4 mr-2" />
                    Merge
                  </Link>
                </DropdownMenuItem>
              )}
              {requestDeletionUrl && (
                <DropdownMenuItem asChild className="text-destructive focus:text-destructive">
                  <Link to={requestDeletionUrl}>
                    <Trash2 className="h-4 w-4 mr-2" />
                    Delete
                  </Link>
                </DropdownMenuItem>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        )}

        {/* Share — smaller, above Edit */}
        <Button
          size="icon"
          variant="secondary"
          onClick={handleShare}
          className="h-10 w-10 rounded-full shadow-md"
          aria-label="Share"
        >
          <Share2 className="h-4 w-4" />
        </Button>

        {/* Edit — large primary FAB, bottommost */}
        {editUrl && (
          <Button asChild size="icon" className="h-14 w-14 rounded-full shadow-lg" aria-label={editLabel}>
            <Link to={editHref}>
              <span className="sr-only">{editLabel}</span>
              {activeEdit?.status === EditStatus.SUBMITTED ? (
                <Eye className="h-6 w-6" />
              ) : (
                <Pencil className="h-6 w-6" />
              )}
            </Link>
          </Button>
        )}
      </div>
    </header>
  );
}
