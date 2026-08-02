import type { LoaderFunctionArgs } from 'react-router';
import { redirect } from 'react-router';

/** See `students._index.tsx`. A bookmarked program page has to keep working too. */
export function loader({ params }: LoaderFunctionArgs) {
  return redirect(`/teaching/${params.programId}`, { status: 301 });
}
