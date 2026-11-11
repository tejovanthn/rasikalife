import { fromItrans } from '@rasika/core/utils/transliteration';
import { type HeadersFunction, type LoaderFunction, type MetaFunction, data } from 'react-router';
import { Link, useLoaderData } from 'react-router';
import { client } from '~/api.server';
import { BreadcrumbStructuredData } from '~/components/structured-data';
import { PRIVATE_PAGE_CACHE_CONTROL, publicPageCacheControl } from '~/lib/auth.server';
import { groupJanyaByParent, janyaListMeta } from '~/lib/hub-lists';
import { MELAKARTA_LINKS } from '~/lib/melakarta-links';
import { generateRagaUrl } from '~/lib/url-slug';
import { titleCaseName } from '~/lib/utils';
import { scriptSessionResolver } from '~/sessions.server';

export const headers: HeadersFunction = ({ loaderHeaders }) => ({
  'Cache-Control': loaderHeaders.get('Cache-Control') ?? PRIVATE_PAGE_CACHE_CONTROL,
});

type Group = {
  mela: number;
  parentName: string;
  parentUrl: string;
  janyas: Array<{ id: string; name: string; url: string }>;
};

export const loader: LoaderFunction = async ({ request }) => {
  const script = await scriptSessionResolver.getScript(request);
  let janyas: Awaited<ReturnType<typeof client.raga.janyaList.query>>;
  try {
    janyas = await client.raga.janyaList.query();
  } catch (error) {
    console.error('Failed to load janya ragas:', error);
    throw new Response('Failed to load janya ragas', { status: 500 });
  }
  const display = (name: string) => titleCaseName(fromItrans(name, script));
  const groups: Group[] = groupJanyaByParent(janyas, MELAKARTA_LINKS).map(g => ({
    mela: g.mela,
    parentName: display(g.parentName),
    parentUrl: generateRagaUrl(g.parentName, g.parentId),
    janyas: g.janyas
      .map(j => ({ id: j.id, name: display(j.name), url: generateRagaUrl(j.name, j.id) }))
      .sort((a, b) => a.name.localeCompare(b.name)),
  }));
  const total = groups.reduce((n, g) => n + g.janyas.length, 0);
  return data(
    { groups, total },
    { headers: { 'Cache-Control': await publicPageCacheControl(request) } }
  );
};

export const meta: MetaFunction = ({ data }) => {
  const d = data as { groups: Group[]; total: number } | undefined;
  const { title, description } = janyaListMeta({
    ragas: d?.total ?? 0,
    parents: d?.groups.length ?? 0,
  });
  return [
    { title },
    { name: 'description', content: description },
    { tagName: 'link', rel: 'canonical', href: 'https://rasika.life/carnatic/ragas/janya' },
  ];
};

export default function JanyaList() {
  const { groups, total } = useLoaderData<{ groups: Group[]; total: number }>();

  return (
    <main className="container mx-auto px-4 py-8 max-w-4xl">
      <header className="mb-8">
        <h1 className="page-title">Janya Ragas</h1>
        <p className="text-xl text-muted-foreground">
          A janya raga is derived from a melakarta, its parent scale. Here are {total} janya ragas
          under their parent melakarta. See also the{' '}
          <Link to="/carnatic/ragas/melakarta" className="text-primary hover:underline">
            72 melakarta ragas
          </Link>
          .
        </p>
      </header>

      {groups.map(g => (
        <section key={g.mela} aria-labelledby={`mela-${g.mela}`} className="mb-6">
          <h2 id={`mela-${g.mela}`} className="text-xl font-semibold mb-2">
            <Link to={g.parentUrl} className="hover:underline">
              {g.mela}. {g.parentName}
            </Link>
          </h2>
          <ul className="flex flex-wrap gap-x-4 gap-y-1 text-sm">
            {g.janyas.map(j => (
              <li key={j.id}>
                <Link to={j.url} className="text-primary hover:underline">
                  {j.name}
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ))}
      <BreadcrumbStructuredData
        items={[
          { name: 'Home', item: 'https://rasika.life' },
          { name: 'Carnatic', item: 'https://rasika.life/carnatic' },
          { name: 'Ragas', item: 'https://rasika.life/carnatic/ragas' },
          { name: 'Janya ragas', item: 'https://rasika.life/carnatic/ragas/janya' },
        ]}
      />
    </main>
  );
}
