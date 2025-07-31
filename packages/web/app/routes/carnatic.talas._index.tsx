import type { Tala } from '@rasika/core';
import { GenericErrorBoundary, GenericIndexRoute } from '~/components/shared';
import { talaSuite } from '~/lib/genericFactories';
import { entityConfigs } from '~/lib/routeConfig';

const config = entityConfigs.talas;

export const loader = talaSuite.loaders.search;
export const meta = talaSuite.meta.search;

export default function TalasIndex() {
  return <GenericIndexRoute<Tala> config={config} />;
}

export function ErrorBoundary() {
  const props = talaSuite.components.errorBoundaryProps;
  return <GenericErrorBoundary {...props} />;
}
