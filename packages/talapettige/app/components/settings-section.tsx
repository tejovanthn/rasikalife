import { Card } from '@rasika/ui';
import { ChevronDown } from 'lucide-react';
import type * as React from 'react';

/**
 * A card that opens to show its settings, with a one-line summary while closed.
 *
 * A `<details>` rather than a scripted collapsible: this is a disclosure, which is what the
 * element is for, and it needs no library. Whether it is open is kept in the caller's saved
 * settings, so it opens the way it was left.
 */
export function SettingsSection({
  title,
  summary,
  open,
  onOpenChange,
  children,
}: {
  title: string;
  summary: React.ReactNode;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  children: React.ReactNode;
}) {
  return (
    <Card>
      <details
        open={open}
        onToggle={event => onOpenChange(event.currentTarget.open)}
        className="group"
      >
        <summary className="flex min-h-tap cursor-pointer list-none items-center justify-between gap-3 rounded-lg p-4 hover:bg-accent/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring [&::-webkit-details-marker]:hidden">
          <span className="flex min-w-0 flex-wrap items-baseline gap-x-3">
            <span className="font-semibold text-lg">{title}</span>
            <span className="text-muted-foreground text-sm">{summary}</span>
          </span>
          <ChevronDown
            className="h-5 w-5 shrink-0 text-muted-foreground transition-transform group-open:rotate-180"
            aria-hidden
          />
        </summary>
        <div className="space-y-5 p-4 pt-0">{children}</div>
      </details>
    </Card>
  );
}
