import type { Raga } from '@rasika/core';
import { GenericErrorBoundary, GenericIndexRoute } from '~/components/shared';
import { ragaSuite } from '~/lib/genericFactories';
import { entityConfigs } from '~/lib/routeConfig';

const config = entityConfigs.ragas;

export const loader = ragaSuite.loaders.search;
export const meta = ragaSuite.meta.search;

export default function RagasIndex() {
  return <GenericIndexRoute<Raga> config={config} />;
}

export function ErrorBoundary() {
  const props = ragaSuite.components.errorBoundaryProps;
  return <GenericErrorBoundary {...props} />;
}
