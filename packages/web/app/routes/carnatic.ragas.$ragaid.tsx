import { Link, useLoaderData } from '@remix-run/react';
import { GenericDetailRoute, GenericErrorBoundary } from '~/components/shared';
import { detailConfigs } from '~/lib/detailRouteConfig';
import { entityUrls } from '~/lib/entityUtils';
import { ragaSuite } from '~/lib/genericFactories';

const config = detailConfigs.ragas;

export const loader = ragaSuite.loaders.detail;
export const meta = ragaSuite.meta.detail;

export default function RagaDetails() {
  return <GenericDetailRoute config={config} />;
}

function RagaCustomSections() {
  const { entity: raga } = useLoaderData<{ entity: any }>();

  return (
    <section className="mb-12">
      <h2 className="scroll-m-20 border-b pb-2 text-2xl font-semibold tracking-tight mb-4">
        Musical Characteristics
      </h2>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {raga.arohana && (
          <div className="bg-gray-50 p-4 rounded-lg">
            <h3 className="font-semibold text-lg mb-2">Arohana (Ascending)</h3>
            <p className="text-gray-700 font-mono">{raga.arohana}</p>
          </div>
        )}

        {raga.avarohana && (
          <div className="bg-gray-50 p-4 rounded-lg">
            <h3 className="font-semibold text-lg mb-2">Avarohana (Descending)</h3>
            <p className="text-gray-700 font-mono">{raga.avarohana}</p>
          </div>
        )}

        {raga.mood && (
          <div className="bg-gray-50 p-4 rounded-lg">
            <h3 className="font-semibold text-lg mb-2">Associated Mood</h3>
            <p className="text-gray-700">{raga.mood}</p>
          </div>
        )}

        {raga.timeOfDay && (
          <div className="bg-gray-50 p-4 rounded-lg">
            <h3 className="font-semibold text-lg mb-2">Auspicious Time</h3>
            <p className="text-gray-700">{raga.timeOfDay}</p>
          </div>
        )}
      </div>

      {raga.characteristicPhrases && raga.characteristicPhrases.length > 0 && (
        <div className="mt-6 bg-blue-50 p-4 rounded-lg border border-blue-200">
          <h3 className="font-semibold text-lg mb-2 text-blue-900">Characteristic Phrases</h3>
          <ul className="space-y-1">
            {raga.characteristicPhrases.map((phrase: string, index: number) => (
              <li key={index} className="text-blue-700 font-mono">
                • {phrase}
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}

function RelatedCompositions() {
  const { relatedItems: relatedCompositions } = useLoaderData<{ relatedItems: any[] }>();

  if (relatedCompositions.length === 0) return null;

  return (
    <section className="mb-12">
      <h2 className="scroll-m-20 border-b pb-2 text-2xl font-semibold tracking-tight mb-6">
        Compositions in this Raga
      </h2>
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {relatedCompositions.map(composition => (
          <Link
            key={composition.id}
            to={entityUrls.detail('compositions', composition.title, composition.id)}
            className="block p-4 border rounded-lg hover:shadow-md transition-shadow bg-white"
          >
            <div className="flex items-center space-x-3">
              <div>
                <div className="font-medium">{composition.title}</div>
                <div className="text-sm text-gray-600">Composition</div>
              </div>
            </div>
          </Link>
        ))}
      </div>
    </section>
  );
}

export function ErrorBoundary() {
  const props = ragaSuite.components.errorBoundaryProps;
  return <GenericErrorBoundary {...props} />;
}
