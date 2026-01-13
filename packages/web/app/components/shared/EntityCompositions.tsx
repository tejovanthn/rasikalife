import { Link } from '@remix-run/react';
import { CompositionCard } from '~/components/CompositionCard';
import { EmptyState } from './EmptyState';

type Composition = {
  id: string;
  title: string;
  composer: {
    id: string;
    name: string;
  };
  language: string;
  lyricsV1?: Array<{
    type: string;
    order: number;
    text: string;
    number?: number;
    ragaName?: string;
  }>;
  ragas: Array<{ id: string; name: string }>;
  talas: Array<{ id: string; name: string }>;
  createdAt: string;
  updatedAt: string;
};

type EntityCompositionsProps = {
  compositions: Composition[];
  entityType: 'artist' | 'raga' | 'tala' | 'language';
  entitySlug: string;
  showViewMore?: boolean;
  customHeading?: string;
};

export function EntityCompositions({
  compositions,
  entityType,
  entitySlug,
  showViewMore = false,
  customHeading,
}: EntityCompositionsProps) {
  const entityTypeSingular = entityType; // artist -> artist, raga -> raga, tala -> tala
  // showViewMore is now passed as a prop

  if (!compositions.length) {
    return (
      <EmptyState
        message="No compositions found"
        description={`There are no compositions associated with this ${entityTypeSingular} yet.`}
      />
    );
  }

  return (
    <section>
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-2xl font-semibold">
          {customHeading || `Compositions in this ${entityTypeSingular}`}
        </h2>
        {showViewMore && (
          <Link
            to={
              entityType === 'language'
                ? `/carnatic/languages/${encodeURIComponent(entitySlug)}`
                : `/carnatic/${entityType}s/${entitySlug}/compositions`
            }
            className="text-sm text-primary hover:underline"
          >
            View all compositions →
          </Link>
        )}
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        {compositions.slice(0, 6).map(composition => (
          <CompositionCard
            key={composition.id}
            composition={composition}
            showRagas={entityType !== 'raga'}
            showTalas={entityType !== 'tala'}
            showComposer={entityType !== 'artist'}
          />
        ))}
      </div>
    </section>
  );
}
