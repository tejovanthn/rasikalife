import { Link } from '@remix-run/react';
import { Card, CardContent, CardHeader, CardTitle } from '~/components/ui/card';
import { Badge } from '~/components/ui/badge';

interface TalaCardProps {
  tala: {
    id: string;
    name: string;
    createdAt: string;
  };
}

export function TalaCard({ tala }: TalaCardProps) {
  return (
    <Link
      to={`/carnatic/talas/${tala.name.toLowerCase().replace(/\s+/g, '-')}-${tala.id}`}
      className="block transition-transform hover:scale-[1.02]"
    >
      <Card className="h-full">
        <CardHeader className="pb-3">
          <CardTitle className="text-lg">{tala.name}</CardTitle>
          <Badge variant="secondary">Tala</Badge>
        </CardHeader>
        <CardContent className="pt-0">
          <p className="text-sm text-muted-foreground">
            Added {new Date(tala.createdAt).toLocaleDateString()}
          </p>
        </CardContent>
      </Card>
    </Link>
  );
}
