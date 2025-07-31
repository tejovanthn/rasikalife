interface EmptyStateProps {
  message: string;
  description?: string;
  className?: string;
}

export function EmptyState({ message, description, className = '' }: EmptyStateProps) {
  return (
    <div className={`text-center py-12 ${className}`}>
      <p className="text-muted-foreground text-lg">{message}</p>
      {description && <p className="text-muted-foreground text-sm mt-2">{description}</p>}
    </div>
  );
}
