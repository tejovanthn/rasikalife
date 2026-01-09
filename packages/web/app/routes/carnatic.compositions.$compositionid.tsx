import type { Composition } from '@rasika/core';
import { Await, Link, useLoaderData } from '@remix-run/react';
import { Suspense } from 'react';
import { OptimisticViewCounter } from '~/components/OptimisticViewCounter';
import {
  RelatedCompositions as RelatedCompositionsComponent,
  RelatedCompositionsSkeleton,
} from '~/components/RelatedCompositions';
import { GenericDetailRoute, GenericErrorBoundary } from '~/components/shared';
import { detailConfigs } from '~/lib/detailRouteConfig';
import { entityFormatters, entityUrls } from '~/lib/entityUtils';
import { compositionSuite } from '~/lib/genericFactories';

const config = detailConfigs.compositions;

export const loader = compositionSuite.loaders.detail;

export const meta = compositionSuite.meta.detail;

export default function CompositionDetails() {
  return (
    <GenericDetailRoute<Composition, Composition>
      config={config}
      customSections={<CompositionCustomSections />}
      relatedItemsComponent={<RelatedCompositions />}
    />
  );
}

function CompositionCustomSections() {
  const { entity: composition, relatedItems: relatedCompositions } = useLoaderData<{
    entity: Composition;
    relatedItems: Composition[];
  }>();

  return (
    <>
      {/* Alternative Titles */}
      {composition.alternativeTitles && composition.alternativeTitles.length > 0 && (
        <section className="mb-8">
          <p className="text-lg text-muted-foreground">
            Also known as: {composition.alternativeTitles.join(', ')}
          </p>
        </section>
      )}

      {/* Source Attribution */}
      {(composition.sourceUrl || composition.lastUpdated) && (
        <section className="mb-8">
          <div className="p-4 bg-blue-50 rounded-lg border border-blue-200">
            <h3 className="text-sm font-semibold text-blue-900 mb-2">Source Information</h3>
            <div className="space-y-2">
              {composition.sourceUrl && (
                <div className="flex items-center space-x-2">
                  <span className="text-sm text-blue-700">Original source:</span>
                  <a
                    href={composition.sourceUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sm text-blue-600 hover:text-blue-800 underline"
                  >
                    karnatik.com
                  </a>
                </div>
              )}
              {composition.lastUpdated && (
                <div className="flex items-center space-x-2">
                  <span className="text-sm text-blue-700">Last updated:</span>
                  <span className="text-sm text-blue-600">
                    {new Date(composition.lastUpdated).toLocaleDateString('en-US', {
                      year: 'numeric',
                      month: 'long',
                      day: 'numeric',
                    })}
                  </span>
                </div>
              )}
            </div>
          </div>
        </section>
      )}

      {/* Related Links */}
      <section className="mb-8">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 p-4 bg-muted rounded-lg">
          <div>
            <span className="font-semibold">Raga:</span>{' '}
            {composition.ragaIds && composition.ragaIds.length > 0 ? (
              <span>
                {composition.ragaIds.length} raga{composition.ragaIds.length > 1 ? 's' : ''}
              </span>
            ) : (
              <span className="text-muted-foreground">Unknown</span>
            )}
          </div>
          <div>
            <span className="font-semibold">Tala:</span>{' '}
            {composition.talaIds && composition.talaIds.length > 0 ? (
              <span>
                {composition.talaIds.length} tala{composition.talaIds.length > 1 ? 's' : ''}
              </span>
            ) : (
              <span className="text-muted-foreground">Unknown</span>
            )}
          </div>
          {composition.language && (
            <div>
              <span className="font-semibold">Language:</span> {composition.language}
            </div>
          )}
          {composition.tradition && (
            <div>
              <span className="font-semibold">Tradition:</span> {composition.tradition}
            </div>
          )}
        </div>
      </section>
    </>
  );
}

function RelatedCompositions() {
  const { entity: composition, relatedItems } = useLoaderData<{
    entity: Composition;
    relatedItems: Composition[];
  }>();

  return <RelatedCompositionsComponent compositions={relatedItems} />;
}

export function ErrorBoundary() {
  const props = compositionSuite.components.errorBoundaryProps;
  return <GenericErrorBoundary {...props} />;
}
