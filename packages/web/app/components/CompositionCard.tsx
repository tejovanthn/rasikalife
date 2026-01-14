import { Link } from 'react-router';
import { Badge } from '~/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '~/components/ui/card';

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
  showLanguage?: boolean;
}

export function CompositionCard({
  composition,
  showRagas = true,
  showTalas = true,
  showComposer = true,
  showLanguage = true,
}: CompositionCardProps) {
  return (
    <Link
      to={`/carnatic/compositions/${composition.title.toLowerCase().replace(/\s+/g, '-')}-${composition.id}`}
      className="block cursor-pointer transition-all hover:scale-[1.02] hover:shadow-lg focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 rounded-lg"
      aria-label={`View composition: ${composition.title} by ${composition.composer.name}`}
    >
      <Card className="h-full">
        <CardHeader className="pb-3">
          <CardTitle className="text-lg leading-tight hover:underline">
            {composition.title}
          </CardTitle>
          <div className="flex flex-wrap gap-1">
            {showLanguage && <Badge variant="language">{composition.language}</Badge>}
            {showRagas &&
              composition.ragas &&
              composition.ragas.map(raga => (
                <Badge key={raga.id} variant="raga">
                  {raga.name}
                </Badge>
              ))}
            {showTalas &&
              composition.talas &&
              composition.talas.map(tala => (
                <Badge key={tala.id} variant="tala">
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
