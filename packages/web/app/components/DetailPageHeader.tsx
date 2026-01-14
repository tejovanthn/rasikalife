import { ShareButtons } from '~/components/ui/share-buttons';

interface DetailPageHeaderProps {
  title: string;
  subtitle: string;
  shareUrl: string;
  shareTitle: string;
  shareDescription: string;
}

export function DetailPageHeader({
  title,
  subtitle,
  shareUrl,
  shareTitle,
  shareDescription,
}: DetailPageHeaderProps) {
  return (
    <header className="mb-8">
      <div className="flex items-start justify-between mb-4">
        <div className="flex-1">
          <h1 className="text-4xl font-bold mb-2">{title}</h1>
          <p className="text-lg text-muted-foreground">{subtitle}</p>
        </div>
        <ShareButtons url={shareUrl} title={shareTitle} description={shareDescription} />
      </div>
    </header>
  );
}
