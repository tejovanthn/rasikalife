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
      className="group block cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 rounded-lg"
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
