import { Link } from '@remix-run/react';
import { Card, CardContent, CardHeader, CardTitle } from '~/components/ui/card';
import { Badge } from '~/components/ui/badge';

interface RagaCardProps {
  raga: {
    id: string;
    name: string;
    createdAt: string;
  };
}

export function RagaCard({ raga }: RagaCardProps) {
  return (
    <Link
      to={`/carnatic/ragas/${raga.name.toLowerCase().replace(/\s+/g, '-')}-${raga.id}`}
      className="block transition-transform hover:scale-[1.02]"
    >
      <Card className="h-full">
        <CardHeader className="pb-3">
          <CardTitle className="text-lg">{raga.name}</CardTitle>
          <Badge variant="secondary">Raga</Badge>
        </CardHeader>
        <CardContent className="pt-0">
          <p className="text-sm text-muted-foreground">
            Added {new Date(raga.createdAt).toLocaleDateString()}
          </p>
        </CardContent>
      </Card>
    </Link>
  );
}
