import { Outlet } from '@remix-run/react';
import { Header } from '~/components/header';

export default function Index() {
  return (
    <>
      <nav>
        <Header />
      </nav>
      <Outlet />
    </>
  );
}
