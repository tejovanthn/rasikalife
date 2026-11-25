import type { LoaderFunctionArgs } from 'react-router';
import { redirect } from 'react-router';
import { bareCityRedirect } from '~/lib/featured-cities';

// Search Console shows impressions for /bengaluru. It is not a page; the concerts are.
export const loader = ({ request }: LoaderFunctionArgs) => {
  throw redirect(bareCityRedirect('bengaluru', new URL(request.url).search), 301);
};
