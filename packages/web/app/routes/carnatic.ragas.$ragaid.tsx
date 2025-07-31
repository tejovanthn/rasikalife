import type { Raga } from '@rasika/core';
import { GenericDetailRoute, GenericErrorBoundary } from '~/components/shared';
import { detailConfigs } from '~/lib/detailRouteConfig';
import { ragaSuite } from '~/lib/genericFactories';

const config = detailConfigs.ragas;

export const loader = ragaSuite.loaders.detail;
export const meta = ragaSuite.meta.detail;

export default function RagaDetails() {
  return <GenericDetailRoute<Raga, Raga> config={config} />;
}

export function ErrorBoundary() {
  const props = ragaSuite.components.errorBoundaryProps;
  return <GenericErrorBoundary {...props} />;
}
