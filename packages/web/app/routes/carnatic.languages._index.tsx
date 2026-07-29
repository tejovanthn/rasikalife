import { data } from 'react-router';
import type { MetaFunction } from 'react-router';
import { Link, useLoaderData } from 'react-router';
import { BreadcrumbStructuredData } from '~/components/structured-data';

// Common languages used in Carnatic music
const LANGUAGES = [
  'Sanskrit',
  'Telugu',
  'Tamil',
  'Kannada',
  'Malayalam',
  'Hindi',
  'Marathi',
  'Bengali',
  'Gujarati',
  'Oriya',
];

export const loader = async () => {
  return data({
    languages: LANGUAGES,
  });
};

export const meta: MetaFunction = () => {
  return [
    { title: 'Languages - Indian Classical Music - Rasika.life' },
    {
      name: 'description',
      content:
        'Explore compositions in different languages of Indian classical music. Discover works in Sanskrit, Telugu, Tamil, and other regional languages.',
    },
    {
      name: 'keywords',
      content:
        'Indian classical languages, Carnatic music languages, Sanskrit compositions, Telugu kritis, Tamil songs, classical music lyrics',
    },
    { tagName: 'link', rel: 'canonical', href: 'https://rasika.life/carnatic/languages' },
  ];
};

export default function LanguagesIndex() {
  const { languages } = useLoaderData<{ languages: string[] }>();

  return (
    <main className="container mx-auto px-4 py-8 max-w-6xl">
      <header className="mb-8">
        <h1 className="page-title">Languages</h1>
        <p className="text-xl text-muted-foreground">
          Explore compositions in different languages of Indian classical music
        </p>
      </header>

      {languages.length === 0 ? (
        <div className="text-center py-12">
          <p className="text-muted-foreground">No languages available at the moment.</p>
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {languages.map((language: string) => (
            <Link
              key={language}
              to={`/carnatic/languages/${encodeURIComponent(language)}`}
              className="p-6 bg-card border rounded-lg hover:bg-accent transition-colors block"
            >
              <h2 className="text-xl font-semibold mb-2">{language}</h2>
              <p className="text-sm text-muted-foreground">Compositions in {language}</p>
            </Link>
          ))}
        </div>
      )}

      {/* Three identical cards saying "Browse all compositions", "Discover the tradition" and
          "Explore musicians" told a reader nothing they could not guess. A plain row of links
          keeps the navigation and drops the furniture. */}
      <nav aria-label="Browse elsewhere" className="mt-10 border-t pt-6">
        <ul className="flex flex-wrap gap-x-6 gap-y-2 text-sm">
          <li>
            <Link to="/carnatic/compositions" className="text-primary hover:underline">
              All Compositions
            </Link>
          </li>
          <li>
            <Link to="/carnatic" className="text-primary hover:underline">
              Carnatic Music
            </Link>
          </li>
          <li>
            <Link to="/artists" className="text-primary hover:underline">
              Artists
            </Link>
          </li>
        </ul>
      </nav>
      <BreadcrumbStructuredData
        items={[
          { name: 'Home', item: 'https://rasika.life' },
          { name: 'Carnatic', item: 'https://rasika.life/carnatic' },
          { name: 'Languages', item: 'https://rasika.life/carnatic/languages' },
        ]}
      />
    </main>
  );
}
