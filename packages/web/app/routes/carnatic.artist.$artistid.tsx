import { redirect } from 'react-router';
import type { LoaderFunction } from 'react-router';

export const loader: LoaderFunction = async ({ params }) => {
  const { artistid } = params;

  if (!artistid) {
    throw new Response('Artist ID is required', { status: 400 });
  }

  // Redirect from singular "artist" to plural "artists"
  return redirect(`/carnatic/artists/${artistid}`, { status: 301 });
};
