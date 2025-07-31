import { Link } from '@remix-run/react';

interface SectionHeaderProps {
  title: string;
  viewAllPath?: string;
  viewAllText?: string;
  className?: string;
}

export function SectionHeader({
  title,
  viewAllPath,
  viewAllText = 'View All →',
  className = '',
}: SectionHeaderProps) {
  return (
    <div className={`flex justify-between items-center mb-6 ${className}`}>
      <h2 className="text-3xl font-bold text-foreground">{title}</h2>
      {viewAllPath && (
        <Link to={viewAllPath} className="text-primary hover:text-primary/80 font-medium">
          {viewAllText}
        </Link>
      )}
    </div>
  );
}
