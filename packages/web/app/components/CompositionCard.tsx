import { Link } from '@remix-run/react';
import { Card, CardContent, CardHeader, CardTitle } from '~/components/ui/card';
import { Badge } from '~/components/ui/badge';

interface CompositionCardProps {
  composition: {
    id: string;
    title: string;
    composer: {
      id: string;
      name: string;
    };
    language: string;
    createdAt: string;
  };
}

export function CompositionCard({ composition }: CompositionCardProps) {
  return (
    <Link
      to={`/carnatic/compositions/${composition.title.toLowerCase().replace(/\s+/g, '-')}-${composition.id}`}
      className="block transition-transform hover:scale-[1.02]"
    >
      <Card className="h-full">
        <CardHeader className="pb-3">
          <CardTitle className="text-lg leading-tight">{composition.title}</CardTitle>
          <div className="flex flex-wrap gap-1">
            <Badge variant="outline">{composition.language}</Badge>
          </div>
        </CardHeader>
        <CardContent className="pt-0">
          <p className="text-sm text-muted-foreground mb-2">
            Composer: {composition.composer.name}
          </p>
          <p className="text-xs text-muted-foreground">
            Added {new Date(composition.createdAt).toLocaleDateString()}
          </p>
        </CardContent>
      </Card>
    </Link>
  );
}
