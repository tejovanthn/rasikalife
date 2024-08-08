import { Outlet } from '@remix-run/react';
import { Header } from '~/components/header';

export default function CarnaticLayout() {
  return (
    <>
      <nav>
        <Header />
      </nav>
      <div className="mb-20">
        <Outlet />
      </div>
    </>
  );
}
