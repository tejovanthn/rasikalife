import { redirect } from '@remix-run/node';
import type { LoaderFunction } from '@remix-run/node';

export const loader: LoaderFunction = async ({ params }) => {
  const { artistid } = params;

  if (!artistid) {
    throw new Response('Artist ID is required', { status: 400 });
  }

  // Redirect from singular "artist" to plural "artists"
  return redirect(`/carnatic/artists/${artistid}`, { status: 301 });
};
