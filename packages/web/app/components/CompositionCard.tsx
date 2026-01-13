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
    ragas?: Array<{ id: string; name: string }>;
    talas?: Array<{ id: string; name: string }>;
    createdAt: string;
  };
  showRagas?: boolean;
  showTalas?: boolean;
  showComposer?: boolean;
}

export function CompositionCard({
  composition,
  showRagas = true,
  showTalas = true,
  showComposer = true,
}: CompositionCardProps) {
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
            {showRagas &&
              composition.ragas &&
              composition.ragas.map(raga => (
                <Badge key={raga.id} variant="secondary">
                  {raga.name}
                </Badge>
              ))}
            {showTalas &&
              composition.talas &&
              composition.talas.map(tala => (
                <Badge key={tala.id} variant="secondary">
                  {tala.name}
                </Badge>
              ))}
          </div>
        </CardHeader>
        <CardContent className="pt-0">
          {showComposer && (
            <p className="text-sm text-muted-foreground">Composer: {composition.composer.name}</p>
          )}
        </CardContent>
      </Card>
    </Link>
  );
}
