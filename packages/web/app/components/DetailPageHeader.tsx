import type { Edit } from '@rasika/core/domain/edit/client';
import { EditStatus } from '@rasika/core/domain/edit/client';
import { Eye, Pencil } from 'lucide-react';
import { Link } from 'react-router';
import { Button } from '~/components/ui/button';
import { ShareButtons } from '~/components/ui/share-buttons';

interface DetailPageHeaderProps {
  title: string;
  subtitle: string;
  shareUrl: string;
  shareTitle: string;
  shareDescription: string;
  editUrl?: string;
  activeEdit?: Edit | null;
}

export function DetailPageHeader({
  title,
  subtitle,
  shareUrl,
  shareTitle,
  shareDescription,
  editUrl,
  activeEdit,
}: DetailPageHeaderProps) {
  const getEditButton = () => {
    if (!editUrl) return null;

    if (activeEdit?.status === EditStatus.DRAFT) {
      return (
        <Button asChild variant="secondary" size="sm">
          <Link to={editUrl}>
            <Pencil className="h-4 w-4" />
            Continue editing
          </Link>
        </Button>
      );
    }

    if (activeEdit?.status === EditStatus.SUBMITTED) {
      return (
        <Button asChild variant="secondary" size="sm">
          <Link to={`/my-edits?editId=${activeEdit.id}`}>
            <Eye className="h-4 w-4" />
            View edit status
          </Link>
        </Button>
      );
    }

    return (
      <Button asChild variant="secondary" size="sm">
        <Link to={editUrl}>
          <Pencil className="h-4 w-4" />
          Edit
        </Link>
      </Button>
    );
  };

  return (
    <header className="mb-8">
      <div className="flex items-start justify-between mb-4">
        <div className="flex-1">
          <h1 className="text-4xl font-bold mb-2">{title}</h1>
          <p className="text-lg text-muted-foreground">{subtitle}</p>
        </div>
        <div className="flex items-center gap-3">
          {getEditButton()}
          <ShareButtons url={shareUrl} title={shareTitle} description={shareDescription} />
        </div>
      </div>
    </header>
  );
}
