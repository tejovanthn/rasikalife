import { Link, useLoaderData } from '@remix-run/react';
import type { Artist } from '@rasika/core';
import { GenericDetailRoute, GenericErrorBoundary } from '~/components/shared';
import { detailConfigs } from '~/lib/detailRouteConfig';
import { entityUrls } from '~/lib/entityUtils';
import { artistSuite } from '~/lib/genericFactories';

const config = detailConfigs.artists;

export const loader = artistSuite.loaders.detail;
export const meta = artistSuite.meta.detail;

export default function ArtistDetails() {
  return (
    <GenericDetailRoute<Artist, Artist>
      config={config}
      customSections={<ArtistCustomSections />}
      relatedItemsComponent={<RelatedArtists />}
    />
  );
}

function ArtistCustomSections() {
  const { entity: artist } = useLoaderData<{ entity: Artist }>();

  return (
    <section className="mb-12">
      <h2 className="scroll-m-20 border-b pb-2 text-2xl font-semibold tracking-tight mb-4">
        Musical Profile
      </h2>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {artist.instruments && artist.instruments.length > 0 && (
          <div className="bg-gray-50 p-4 rounded-lg">
            <h3 className="font-semibold text-lg mb-2">Instruments</h3>
            <ul className="space-y-1">
              {artist.instruments.map((instrument: string) => (
                <li key={instrument} className="text-gray-700">
                  • {instrument}
                </li>
              ))}
            </ul>
          </div>
        )}

        {artist.traditions && artist.traditions.length > 0 && (
          <div className="bg-gray-50 p-4 rounded-lg">
            <h3 className="font-semibold text-lg mb-2">Traditions</h3>
            <ul className="space-y-1">
              {artist.traditions.map((tradition: string) => (
                <li key={tradition} className="text-gray-700">
                  • {tradition}
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </section>
  );
}

function RelatedArtists() {
  const { relatedItems: relatedArtists } = useLoaderData<{ relatedItems: Artist[] }>();

  if (relatedArtists.length === 0) return null;

  return (
    <section className="mb-12">
      <h2 className="scroll-m-20 border-b pb-2 text-2xl font-semibold tracking-tight mb-6">
        Related Artists
      </h2>
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {relatedArtists.map(relatedArtist => (
          <Link
            key={relatedArtist.id}
            to={entityUrls.detail('artists', relatedArtist.name, relatedArtist.id)}
            className="block p-4 border rounded-lg hover:shadow-md transition-shadow bg-white"
          >
            <div className="flex items-center space-x-3">
              {relatedArtist.profileImage && (
                <img
                  src={relatedArtist.profileImage}
                  alt={relatedArtist.name}
                  className="w-12 h-12 rounded-full object-cover"
                />
              )}
              <div>
                <div className="font-medium">{relatedArtist.name}</div>
                <div className="text-sm text-gray-600">{relatedArtist.artistType}</div>
              </div>
            </div>
          </Link>
        ))}
      </div>
    </section>
  );
}

export function ErrorBoundary() {
  const props = artistSuite.components.errorBoundaryProps;
  return <GenericErrorBoundary {...props} />;
}
