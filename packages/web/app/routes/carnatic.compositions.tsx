import { Outlet } from '@remix-run/react';

export default function CompositionsLayout() {
  return (
    <main className="container mx-auto px-4 py-8 max-w-6xl">
      <Outlet />
    </main>
  );
}

export function ErrorBoundary() {
  return (
    <div className="text-center py-8">
      <h1 className="text-2xl font-bold text-red-600 mb-4">Something went wrong</h1>
      <p className="text-muted-foreground mb-4">
        We're having trouble loading the compositions. Please try again later.
      </p>
      <a href="/carnatic/compositions" className="text-blue-600 hover:underline">
        Back to Compositions
      </a>
    </div>
  );
}
