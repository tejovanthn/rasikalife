import { Link } from '@remix-run/react';
import { Card, CardContent, CardHeader, CardTitle } from '~/components/ui/card';
import { Badge } from '~/components/ui/badge';

interface TalaCardProps {
  tala: {
    id: string;
    name: string;
  };
}

export function TalaCard({ tala }: TalaCardProps) {
  return (
    <Link
      to={`/carnatic/talas/${tala.name.toLowerCase().replace(/\s+/g, '-')}-${tala.id}`}
      className="block transition-transform hover:scale-[1.02] focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 rounded-lg"
      aria-label={`View tala: ${tala.name}`}
    >
      <Card className="h-full">
        <CardHeader className="pb-3">
          <CardTitle className="text-lg">{tala.name}</CardTitle>
          <Badge variant="tala">Tala</Badge>
        </CardHeader>
      </Card>
    </Link>
  );
}
