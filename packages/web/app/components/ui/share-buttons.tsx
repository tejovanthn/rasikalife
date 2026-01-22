import { Share2 } from 'lucide-react';
import { Button } from './button';

interface ShareButtonsProps {
  url: string;
  title: string;
  description?: string;
}

export function ShareButtons({ url, title, description }: ShareButtonsProps) {
  const handleShare = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title,
          text: description || title,
          url,
        });
      } catch (error) {
        // User cancelled share or error occurred
      }
    } else {
      // Fallback: copy to clipboard
      try {
        await navigator.clipboard.writeText(url);
        // Could show a toast notification here
        alert('Link copied to clipboard!');
      } catch (error) {
        console.error('Failed to copy:', error);
      }
    }
  };

  return (
    <>
      {/* Desktop: Inline button */}
      <Button
        variant="outline"
        size="sm"
        onClick={handleShare}
        className="hidden md:flex items-center gap-2"
      >
        <Share2 className="h-4 w-4" />
        Share
      </Button>

      {/* Mobile: FAB (Floating Action Button) */}
      <Button
        onClick={handleShare}
        size="icon"
        className="md:hidden fixed bottom-6 right-6 h-14 w-14 rounded-full shadow-lg bg-primary hover:bg-primary/90 z-40"
        aria-label="Share this page"
      >
        <Share2 className="h-6 w-6" />
      </Button>
    </>
  );
}
