import { Link, isRouteErrorResponse, useRouteError } from '@remix-run/react';

interface GenericErrorBoundaryProps {
  entityType: string;
  entityPlural: string;
  basePath: string;
}

export function GenericErrorBoundary({
  entityType,
  entityPlural,
  basePath,
}: GenericErrorBoundaryProps) {
  const error = useRouteError();

  if (isRouteErrorResponse(error)) {
    return (
      <main className="container mx-auto px-4 py-8 max-w-4xl">
        <div className="text-center">
          <h1 className="text-4xl font-bold text-gray-900 mb-4">
            {error.status} - {error.statusText}
          </h1>
          <p className="text-xl text-muted-foreground mb-8">
            {error.status === 404
              ? `The ${entityType} you're looking for doesn't exist or has been moved.`
              : `Something went wrong while loading this ${entityType}.`}
          </p>

          <div className="space-y-4">
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Link
                to={basePath}
                className="inline-flex items-center px-6 py-3 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors"
              >
                Browse All {entityPlural}
              </Link>
              <Link
                to="/"
                className="inline-flex items-center px-6 py-3 border border-input text-muted-foreground rounded-lg hover:bg-accent transition-colors"
              >
                Go Home
              </Link>
            </div>

            <details className="mt-8 text-left max-w-md mx-auto">
              <summary className="cursor-pointer text-sm text-muted-foreground hover:text-foreground">
                Technical Details
              </summary>
              <div className="mt-2 p-4 bg-muted rounded-lg text-sm font-mono">
                <p>
                  <strong>Status:</strong> {error.status}
                </p>
                <p>
                  <strong>Message:</strong> {error.statusText}
                </p>
                <p>
                  <strong>URL:</strong> {location.pathname}
                </p>
              </div>
            </details>
          </div>
        </div>
      </main>
    );
  }

  // Generic error for non-Response errors
  return (
    <main className="container mx-auto px-4 py-8 max-w-4xl">
      <div className="text-center">
        <h1 className="text-4xl font-bold text-red-600 mb-4">Oops! Something went wrong</h1>
        <p className="text-xl text-muted-foreground mb-8">
          We encountered an unexpected error while loading this {entityType}.
        </p>

        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="inline-flex items-center px-6 py-3 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors"
            >
              Try Again
            </button>
            <Link
              to={basePath}
              className="inline-flex items-center px-6 py-3 border border-input text-muted-foreground rounded-lg hover:bg-accent transition-colors"
            >
              Browse All {entityPlural}
            </Link>
          </div>

          {process.env.NODE_ENV === 'development' && (
            <details className="mt-8 text-left max-w-2xl mx-auto">
              <summary className="cursor-pointer text-sm text-muted-foreground hover:text-foreground">
                Error Details (Development)
              </summary>
              <div className="mt-2 p-4 bg-red-50 rounded-lg text-sm font-mono text-red-800 overflow-auto">
                <pre>{error instanceof Error ? error.stack : String(error)}</pre>
              </div>
            </details>
          )}
        </div>
      </div>
    </main>
  );
}
