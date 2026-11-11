import { fromItrans } from '@rasika/core/utils/transliteration';
import { type HeadersFunction, type LoaderFunction, type MetaFunction, data } from 'react-router';
import { Link, useLoaderData } from 'react-router';
import { client } from '~/api.server';
import { EmptyState } from '~/components/shared/EmptyState';
import { BreadcrumbStructuredData } from '~/components/structured-data';
import { PRIVATE_PAGE_CACHE_CONTROL, publicPageCacheControl } from '~/lib/auth.server';
import { varnamListMeta } from '~/lib/hub-lists';
import { generateArtistUrl, generateCompositionUrl } from '~/lib/url-slug';
import { titleCaseName } from '~/lib/utils';
import { scriptSessionResolver } from '~/sessions.server';

export const headers: HeadersFunction = ({ loaderHeaders }) => ({
  'Cache-Control': loaderHeaders.get('Cache-Control') ?? PRIVATE_PAGE_CACHE_CONTROL,
});

type Varnam = { id: string; title: string; url: string; composer: string; composerUrl: string };

export const loader: LoaderFunction = async ({ request }) => {
  const script = await scriptSessionResolver.getScript(request);
  try {
    const rows = await client.composition.byType.query({ compositionType: 'varnam' });
    const varnams: Varnam[] = rows
      .map(c => ({
        id: c.id,
        title: titleCaseName(fromItrans(c.title, script)),
        url: generateCompositionUrl(c.title, c.id),
        composer: titleCaseName(fromItrans(c.composer.name, script)),
        composerUrl: generateArtistUrl(c.composer.name, c.composer.id),
      }))
      .sort((a, b) => a.title.localeCompare(b.title));
    return data(
      { varnams },
      { headers: { 'Cache-Control': await publicPageCacheControl(request) } }
    );
  } catch (error) {
    console.error('Failed to load varnams:', error);
    throw new Response('Failed to load varnams', { status: 500 });
  }
};

export const meta: MetaFunction = ({ data }) => {
  const d = data as { varnams: Varnam[] } | undefined;
  const { title, description } = varnamListMeta(d?.varnams.length ?? 0);
  return [
    { title },
    { name: 'description', content: description },
    {
      tagName: 'link',
      rel: 'canonical',
      href: 'https://rasika.life/carnatic/compositions/varnams',
    },
  ];
};

export default function VarnamList() {
  const { varnams } = useLoaderData<{ varnams: Varnam[] }>();

  return (
    <div className="max-w-4xl">
      <header className="mb-8">
        <h1 className="page-title">Varnam Lyrics</h1>
        <p className="text-xl text-muted-foreground">
          Varnams are the core study pieces of Carnatic music. Open one for its lyrics, raga and
          tala.
        </p>
      </header>

      {varnams.length === 0 ? (
        <EmptyState message="No varnams available at the moment." />
      ) : (
        <ul className="divide-y">
          {varnams.map(v => (
            <li key={v.id} className="flex flex-wrap items-baseline justify-between gap-2 py-2">
              <Link to={v.url} className="text-primary hover:underline">
                {v.title}
              </Link>
              <Link to={v.composerUrl} className="text-sm text-muted-foreground hover:underline">
                {v.composer}
              </Link>
            </li>
          ))}
        </ul>
      )}
      <BreadcrumbStructuredData
        items={[
          { name: 'Home', item: 'https://rasika.life' },
          { name: 'Carnatic', item: 'https://rasika.life/carnatic' },
          { name: 'Compositions', item: 'https://rasika.life/carnatic/compositions' },
          { name: 'Varnams', item: 'https://rasika.life/carnatic/compositions/varnams' },
        ]}
      />
    </div>
  );
}
