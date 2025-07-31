import { Link, useLoaderData } from '@remix-run/react';
import { OptimisticViewCounter } from '~/components/OptimisticViewCounter';
import type { DetailConfig } from '~/lib/detailRouteConfig';

interface GenericDetailRouteProps<T = Record<string, unknown>, R = Record<string, unknown>> {
  config: DetailConfig;
  customSections?: React.ReactNode;
  relatedItemsComponent?: React.ReactNode;
}

interface GenericDetailLoaderData<T = Record<string, unknown>, R = Record<string, unknown>> {
  entity: T;
  relatedItems: R[];
  breadcrumbs: Array<{ name: string; href: string }>;
}

export function GenericDetailRoute<T = Record<string, unknown>, R = Record<string, unknown>>({
  config,
  customSections,
  relatedItemsComponent,
}: GenericDetailRouteProps<T, R>) {
  const { entity, relatedItems, breadcrumbs } = useLoaderData<GenericDetailLoaderData<T, R>>();

  const name = entity[config.nameField];
  const subtitle = config.subtitleField ? entity[config.subtitleField] : undefined;
  const bio = config.bioField ? entity[config.bioField] : undefined;
  const image = config.hasImage && config.imageField ? entity[config.imageField] : undefined;

  const headerSections = config.getHeaderSections(entity);
  const contentSections = config.getContentSections(entity);

  return (
    <main className="container mx-auto px-4 py-8 max-w-4xl">
      {/* Breadcrumbs */}
      <nav className="mb-6">
        <ol className="flex items-center space-x-2 text-sm text-muted-foreground">
          {breadcrumbs.map((crumb, index) => (
            <li key={crumb.href} className="flex items-center">
              {index > 0 && <span className="mr-2">/</span>}
              {index === breadcrumbs.length - 1 ? (
                <span className="text-foreground font-medium">{crumb.name}</span>
              ) : (
                <Link to={crumb.href} className="hover:text-foreground transition-colors">
                  {crumb.name}
                </Link>
              )}
            </li>
          ))}
        </ol>
      </nav>

      {/* Header */}
      <header className="mb-8">
        <div className="flex flex-col md:flex-row md:items-start md:space-x-8">
          {image && (
            <div className="flex-shrink-0 mb-6 md:mb-0">
              <img
                src={image}
                alt={name}
                className="w-32 h-32 md:w-48 md:h-48 rounded-full object-cover mx-auto md:mx-0"
              />
            </div>
          )}

          <div className="flex-1 text-center md:text-left">
            <h1 className="scroll-m-20 text-4xl font-extrabold tracking-tight lg:text-5xl mb-4">
              {name}
            </h1>

            {subtitle && <p className="text-xl text-blue-600 font-medium mb-4">{subtitle}</p>}

            {/* Header Sections */}
            {headerSections.map((section, sectionIndex) => (
              <div key={sectionIndex} className="space-y-2 text-sm text-gray-600 mb-4">
                {section.items.map((item, itemIndex) => {
                  if (!item.value) return null;

                  const displayValue = Array.isArray(item.value)
                    ? item.value.join(', ')
                    : item.value;

                  return (
                    <div key={itemIndex}>
                      <span className="font-semibold">{item.label}:</span> {displayValue}
                    </div>
                  );
                })}
              </div>
            ))}

            {/* View Counter */}
            <OptimisticViewCounter
              entityType={config.type}
              entityId={entity.id}
              initialViewCount={entity.viewCount || 0}
              wasServerTracked={true} // Detail pages track views server-side
            />
          </div>
        </div>
      </header>

      {/* Content Sections */}
      {contentSections.map((section, index) => {
        if (!section.content) return null;

        return (
          <section key={index} className="mb-12">
            <h2 className="scroll-m-20 border-b pb-2 text-2xl font-semibold tracking-tight mb-4">
              {section.title}
            </h2>

            {section.format === 'pre-line' ? (
              <div className="prose prose-sm max-w-none" style={{ whiteSpace: 'pre-line' }}>
                {section.content}
              </div>
            ) : section.format === 'list' ? (
              <ul className="list-disc list-inside space-y-1">
                {section.content.split('\n').map((item: string, i: number) => (
                  <li key={i}>{item}</li>
                ))}
              </ul>
            ) : (
              <p className="text-gray-700">{section.content}</p>
            )}
          </section>
        );
      })}

      {/* Custom Sections */}
      {customSections}

      {/* Related Items */}
      {relatedItemsComponent}

      {/* Footer metadata */}
      <footer className="mt-12 pt-8 border-t text-sm text-gray-500">
        <div className="flex flex-col sm:flex-row sm:justify-between gap-2">
          <div>Profile created: {new Date(entity.createdAt).toLocaleDateString()}</div>
          <div>Last updated: {new Date(entity.updatedAt).toLocaleDateString()}</div>
        </div>
      </footer>
    </main>
  );
}
