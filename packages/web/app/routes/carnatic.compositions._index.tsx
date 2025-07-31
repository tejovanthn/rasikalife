import type { Composition } from '@rasika/core';
import { GenericErrorBoundary, GenericIndexRoute } from '~/components/shared';
import { compositionSuite } from '~/lib/genericFactories';
import { entityConfigs } from '~/lib/routeConfig';

const config = entityConfigs.compositions;

export const loader = compositionSuite.loaders.search;
export const meta = compositionSuite.meta.search;

export default function CompositionsIndex() {
  return <GenericIndexRoute<Composition> config={config} />;
}

export function ErrorBoundary() {
  const props = compositionSuite.components.errorBoundaryProps;
  return <GenericErrorBoundary {...props} />;
}
