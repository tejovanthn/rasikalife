import { redirect } from 'react-router';

/**
 * `/students` moved to `/teaching`.
 *
 * A permanent redirect because the pilot guru has the old path bookmarked and may have installed
 * it as a PWA start URL — an installed app does not re-read the manifest on launch, so hers would
 * open on a 404 until she reinstalled.
 */
export function loader() {
  return redirect('/teaching', { status: 301 });
}
