import { Link } from '@remix-run/react';
import { slugify } from '~/lib/carnaticUtils';

interface Composition {
  id: string;
  title: string;
  ragaName?: string;
  talaName?: string;
  language?: string;
}

interface RelatedCompositionsProps {
  compositions: Composition[];
  ragaName?: string;
}

export function RelatedCompositions({ compositions, ragaName }: RelatedCompositionsProps) {
  if (compositions.length === 0) {
    return (
      <section className="mb-8">
        <h2 className="text-2xl font-bold tracking-tight mb-4">Related Compositions</h2>
        <p className="text-muted-foreground">
          No other compositions found{ragaName ? ` in ${ragaName} raga` : ''}.
        </p>
      </section>
    );
  }

  return (
    <section className="mb-8">
      <h2 className="text-2xl font-bold tracking-tight mb-4">
        Related Compositions {ragaName && `in ${ragaName}`}
      </h2>
      <div className="grid gap-4">
        {compositions.map(composition => (
          <div
            key={composition.id}
            className="p-4 border border-border rounded-lg hover:shadow-md transition-shadow bg-card"
          >
            <div className="flex justify-between items-start">
              <div className="flex-1">
                <Link
                  to={slugify({
                    name: composition.title,
                    id: composition.id,
                    type: 'compositions',
                  })}
                  className="text-lg font-semibold text-primary hover:text-primary/80"
                >
                  {composition.title}
                </Link>
                <div className="text-sm text-muted-foreground mt-1">
                  {composition.talaName && `Tala: ${composition.talaName}`}
                  {composition.language && ` • Language: ${composition.language}`}
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

export function RelatedCompositionsSkeleton() {
  return (
    <section className="mb-8">
      <h2 className="text-2xl font-bold tracking-tight mb-4">Related Compositions</h2>
      <div className="grid gap-4">
        {[1, 2, 3].map(i => (
          <div key={i} className="p-4 border border-border rounded-lg bg-card">
            <div className="animate-pulse">
              <div className="h-6 bg-muted rounded mb-2 w-3/4" />
              <div className="h-4 bg-muted rounded w-1/2" />
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
