import type { Tala } from '@rasika/core';
import { GenericDetailRoute, GenericErrorBoundary } from '~/components/shared';
import { detailConfigs } from '~/lib/detailRouteConfig';
import { talaSuite } from '~/lib/genericFactories';

const config = detailConfigs.talas;

export const loader = talaSuite.loaders.detail;
export const meta = talaSuite.meta.detail;

export default function TalaDetails() {
  return <GenericDetailRoute<Tala, Tala> config={config} />;
}

export function ErrorBoundary() {
  const props = talaSuite.components.errorBoundaryProps;
  return <GenericErrorBoundary {...props} />;
}
