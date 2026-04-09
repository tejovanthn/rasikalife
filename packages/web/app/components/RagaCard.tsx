import { Link } from 'react-router';
import { Badge } from '~/components/ui/badge';
import { Card, CardHeader, CardTitle } from '~/components/ui/card';
import { generateRagaUrl } from '~/lib/url-slug';

interface RagaCardProps {
  raga: {
    id: string;
    name: string;
  };
}

export function RagaCard({ raga }: RagaCardProps) {
  return (
    <Link
      to={generateRagaUrl(raga.name, raga.id)}
      className="group block cursor-pointer focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 rounded-lg"
      aria-label={`View raga: ${raga.name}`}
    >
      <Card className="h-full transition-shadow duration-200 hover:shadow-md">
        <CardHeader className="pb-3">
          <CardTitle className="text-lg group-hover:underline">{raga.name}</CardTitle>
          <Badge variant="raga">Raga</Badge>
        </CardHeader>
      </Card>
    </Link>
  );
}
