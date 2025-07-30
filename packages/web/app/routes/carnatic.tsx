import { Outlet } from '@remix-run/react';

export default function CarnaticLayout() {
  return (
    <div className="min-h-screen">
      {/* Content */}
      <div className="min-h-screen">
        <Outlet />
      </div>
    </div>
  );
}
