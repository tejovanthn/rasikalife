import type { LoaderFunctionArgs } from 'react-router';

const VALID_TYPES = ['raga', 'composition', 'artist'] as const;
type OgType = (typeof VALID_TYPES)[number];

// Thin redirect to the dedicated OG image Lambda. Sharp + native binaries
// can't live in the React server bundle (SST's React SSR bundler strips
// node_modules), so generation runs in `packages/og-image` and we just
// forward the request here to keep `/og/...` URLs on the rasika.life origin.
export async function loader({ params }: LoaderFunctionArgs) {
  const { type, id } = params;
  if (!type || !id || !VALID_TYPES.includes(type as OgType)) {
    return new Response('Not Found', { status: 404 });
  }

  const target = process.env.OG_IMAGE_URL;
  if (!target) {
    return new Response(null, { status: 302, headers: { Location: '/og-image.png' } });
  }

  const location = `${target.replace(/\/$/, '')}/og/${type}/${id}`;
  return new Response(null, { status: 302, headers: { Location: location } });
}
