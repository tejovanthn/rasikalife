import { Link } from 'react-router';

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
      <h2 className="text-3xl font-bold text-foreground border-0 mt-0 pb-0">{title}</h2>
      {viewAllPath && (
        <Link to={viewAllPath} className="text-primary hover:text-primary/80 font-medium">
          {viewAllText}
        </Link>
      )}
    </div>
  );
}
