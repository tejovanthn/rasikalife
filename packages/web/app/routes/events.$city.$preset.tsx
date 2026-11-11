import type { HeadersFunction, LoaderFunctionArgs, MetaFunction } from 'react-router';
import { CityListingPage } from '~/components/events/city-listing-page';
import { type CityListingPageData, cityListingMeta } from '~/lib/city-listing-meta';
import { cityListingLoader } from '~/lib/events-page.server';
import { SIGNED_IN_CACHE_CONTROL } from '~/lib/page-cache';

// /events/<city>/today | this-weekend | this-week: a city's date page, for sharing. Cached until
// midnight in India like the whole-listing date pages; `noindex, follow` (lib/city-listing-meta).
// `/events/<id>/edit` stays its own route: a static segment outranks `$preset`.
export const loader = (args: LoaderFunctionArgs) =>
  cityListingLoader(args, args.params.city ?? '', args.params.preset ?? '');

export const headers: HeadersFunction = ({ loaderHeaders }) => ({
  'Cache-Control': loaderHeaders.get('Cache-Control') ?? SIGNED_IN_CACHE_CONTROL,
});

export const meta: MetaFunction<typeof loader> = ({ data }) =>
  cityListingMeta(data as unknown as CityListingPageData | undefined);

export default CityListingPage;
