import { Outlet } from 'react-router';

// Thin layout for /artists/:artistid and its subroutes (events, compositions, gallery).
// The profile body lives in artists.$artistid._index.tsx, so this parent runs no loader —
// a cold hit to a subroute no longer fires the profile's queries only to discard them, and
// there is no pathname sniffing to keep in sync with the child routes.
export default function ArtistLayout() {
  return <Outlet />;
}
