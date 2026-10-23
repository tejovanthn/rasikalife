import type { LoaderFunctionArgs } from 'react-router';
import { eventsLoader } from '~/lib/events-page.server';

// /events/today: the whole listing for that range, a page of its own with its own canonical.
export { default, headers, meta } from './events._index';
export const loader = (args: LoaderFunctionArgs) => eventsLoader(args, 'today');
