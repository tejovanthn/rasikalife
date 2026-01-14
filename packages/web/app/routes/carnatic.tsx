import { Outlet } from 'react-router';

export default function CarnaticLayout() {
  return (
    <div className="min-h-screen">
      <Outlet />
    </div>
  );
}
