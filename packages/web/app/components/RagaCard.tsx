import { Link } from 'react-router';
import { Card, CardContent, CardHeader, CardTitle } from '~/components/ui/card';
import { Badge } from '~/components/ui/badge';

interface RagaCardProps {
  raga: {
    id: string;
    name: string;
  };
}

export function RagaCard({ raga }: RagaCardProps) {
  return (
    (<Link
      to={`/carnatic/ragas/${raga.name.toLowerCase().replace(/\s+/g, '-')}-${raga.id}`}
      className="block cursor-pointer transition-all hover:scale-[1.02] hover:shadow-lg focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 rounded-lg"
      aria-label={`View raga: ${raga.name}`}
    >
      <Card className="h-full">
        <CardHeader className="pb-3">
          <CardTitle className="text-lg hover:underline">{raga.name}</CardTitle>
          <Badge variant="raga">Raga</Badge>
        </CardHeader>
      </Card>
    </Link>)
  );
}
