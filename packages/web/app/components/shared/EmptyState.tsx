import { Inbox } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

interface EmptyStateProps {
  message: string;
  description?: string;
  className?: string;
  icon?: LucideIcon;
}

export function EmptyState({
  message,
  description,
  className = '',
  icon: Icon = Inbox,
}: EmptyStateProps) {
  return (
    <div className={`text-center py-12 ${className}`}>
      <Icon className="h-12 w-12 text-muted-foreground mx-auto mb-4" aria-hidden="true" />
      <p className="text-muted-foreground text-lg">{message}</p>
      {description && <p className="text-muted-foreground text-sm mt-2">{description}</p>}
    </div>
  );
}
