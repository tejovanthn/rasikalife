import { Outlet } from '@remix-run/react';
import { Header } from '~/components/header';

export default function Index() {
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
