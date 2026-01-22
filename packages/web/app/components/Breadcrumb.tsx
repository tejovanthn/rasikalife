import { Link } from 'react-router';

interface BreadcrumbItem {
  label: string;
  path: string;
}

interface BreadcrumbProps {
  items: BreadcrumbItem[];
  className?: string;
}

export function Breadcrumb({ items, className = '' }: BreadcrumbProps) {
  if (items.length === 0) return null;

  // Mobile version: show Home, ellipsis if needed, and current page
  const mobileItems = items.length > 2 ? [items[0], items[items.length - 1]] : items;

  return (
    <nav className={`mb-6 ${className}`} aria-label="Breadcrumb">
      {/* Desktop: show all items */}
      <ol className="hidden md:flex items-center space-x-2 text-sm text-muted-foreground">
        {items.map((item, index) => (
          <li key={item.path} className="flex items-center">
            {index > 0 && <span className="mx-2">/</span>}
            {index === items.length - 1 ? (
              <span className="font-medium text-foreground">{item.label}</span>
            ) : (
              <Link to={item.path} className="hover:text-foreground transition-colors">
                {item.label}
              </Link>
            )}
          </li>
        ))}
      </ol>

      {/* Mobile: show shortened version with ellipsis */}
      <ol className="flex md:hidden items-center space-x-2 text-sm text-muted-foreground">
        {mobileItems.map((item, index) => (
          <li key={item.path} className="flex items-center">
            {index > 0 && (
              <>
                {items.length > 2 && index === 1 && <span className="mx-2">...</span>}
                <span className="mx-2">/</span>
              </>
            )}
            {index === mobileItems.length - 1 ? (
              <span className="font-medium text-foreground">{item.label}</span>
            ) : (
              <Link to={item.path} className="hover:text-foreground transition-colors">
                {item.label}
              </Link>
            )}
          </li>
        ))}
      </ol>
    </nav>
  );
}
