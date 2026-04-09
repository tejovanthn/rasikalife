import { Link } from 'react-router';
import { Badge } from '~/components/ui/badge';
import { Card, CardHeader, CardTitle } from '~/components/ui/card';
import { generateTalaUrl } from '~/lib/url-slug';

interface TalaCardProps {
  tala: {
    id: string;
    name: string;
  };
}

export function TalaCard({ tala }: TalaCardProps) {
  return (
    <Link
      to={generateTalaUrl(tala.name, tala.id)}
      className="group block cursor-pointer focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 rounded-lg"
      aria-label={`View tala: ${tala.name}`}
    >
      <Card className="h-full transition-shadow duration-200 hover:shadow-md">
        <CardHeader className="pb-3">
          <CardTitle className="text-lg group-hover:underline">{tala.name}</CardTitle>
          <Badge variant="tala">Tala</Badge>
        </CardHeader>
      </Card>
    </Link>
  );
}
