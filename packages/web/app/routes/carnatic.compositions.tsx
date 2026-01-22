import { Outlet } from 'react-router';

export default function CompositionsLayout() {
  return (
    <main className="container mx-auto px-4 py-8 max-w-6xl">
      <Outlet />
    </main>
  );
}
