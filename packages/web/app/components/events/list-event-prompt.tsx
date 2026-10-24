import { Plus } from 'lucide-react';
import { Link } from 'react-router';

/**
 * The way in for whoever runs the concerts a page lists. Shown to every visitor, since these
 * pages are cached signed out; `/events/new` sends a visitor through sign-in and back.
 */
export function ListEventPrompt({ question }: { question: string }) {
  return (
    <p className="mt-6 flex flex-wrap items-center gap-x-2 text-sm text-muted-foreground">
      {question}
      <Link to="/events/new" className="inline-flex min-h-11 items-center gap-1 md:min-h-0">
        <Plus className="h-4 w-4" aria-hidden="true" />
        List your event
      </Link>
    </p>
  );
}
