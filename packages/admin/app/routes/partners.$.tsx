import { type LoaderFunctionArgs, redirect } from 'react-router';

/** The section was called Partners before 2026-11-13; old links and bookmarks land here. */
export function loader({ params, request }: LoaderFunctionArgs) {
  const rest = params['*'] ? `/${params['*']}` : '';
  return redirect(`/sabhas${rest}${new URL(request.url).search}`, 301);
}
