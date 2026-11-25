import { Link } from 'react-router';
import { seasonLinks } from '~/lib/season-links';

/**
 * Plain links to the Chennai and Bengaluru concert pages. They render on the server as <a>, so
 * a crawler follows them. The date picks the Chennai wording (lib/season-links.ts).
 */
export function SeasonLinks({
  city,
  label = 'Find concerts',
  className = '',
}: {
  /** The page's own city, if it has one: that link comes first. */
  city?: string | null;
  label?: string;
  className?: string;
}) {
  const links = seasonLinks(new Date(), city);
  return (
    <nav aria-label="Concerts by city" className={`text-sm text-muted-foreground ${className}`}>
      <span>{label}: </span>
      {links.map((link, i) => (
        <span key={link.slug}>
          {i > 0 && <span aria-hidden="true"> · </span>}
          <Link to={link.href} className="text-primary underline-offset-2 hover:underline">
            {link.text}
          </Link>
        </span>
      ))}
    </nav>
  );
}
