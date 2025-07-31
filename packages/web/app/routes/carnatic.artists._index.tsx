import type { Artist } from '@rasika/core/';
import { GenericErrorBoundary, GenericIndexRoute } from '~/components/shared';
import { artistSuite } from '~/lib/genericFactories';
import { entityConfigs } from '~/lib/routeConfig';

const config = entityConfigs.artists;

export const loader = artistSuite.loaders.search;
export const meta = artistSuite.meta.search;

export default function ArtistsIndex() {
  return <GenericIndexRoute<Artist> config={config} />;
}

export function ErrorBoundary() {
  const props = artistSuite.components.errorBoundaryProps;
  return <GenericErrorBoundary {...props} />;
}
