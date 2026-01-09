import { Link, useLoaderData } from '@remix-run/react';
import { GenericDetailRoute, GenericErrorBoundary } from '~/components/shared';
import { detailConfigs } from '~/lib/detailRouteConfig';
import { entityUrls } from '~/lib/entityUtils';
import { talaSuite } from '~/lib/genericFactories';

const config = detailConfigs.talas;

export const loader = talaSuite.loaders.detail;
export const meta = talaSuite.meta.detail;

export default function TalaDetails() {
  return <GenericDetailRoute config={config} />;
}

export function ErrorBoundary() {
  const props = talaSuite.components.errorBoundaryProps;
  return <GenericErrorBoundary {...props} />;
}
