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
    <GenericDetailRoute
      config={config}
      customSections={<CompositionCustomSections />}
      relatedItemsComponent={<RelatedCompositions />}
    />
  );
}

function CompositionCustomSections() {
  const { entity: composition, relatedItems: relatedCompositions } = useLoaderData<{
    entity: any;
    relatedItems: any[];
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
    </>
  );
}

function RelatedCompositions() {
  const { entity: composition, relatedItems } = useLoaderData<{
    entity: any;
    relatedItems: any[];
  }>();

  return <RelatedCompositionsComponent compositions={relatedItems} />;
}

export function ErrorBoundary() {
  const props = compositionSuite.components.errorBoundaryProps;
  return <GenericErrorBoundary {...props} />;
}
