import { fromItrans } from '@rasika/core/utils/transliteration';
import { type HeadersFunction, type LoaderFunction, type MetaFunction, data } from 'react-router';
import { Link, useLoaderData } from 'react-router';
import { BreadcrumbStructuredData } from '~/components/structured-data';
import { PRIVATE_PAGE_CACHE_CONTROL, publicPageCacheControl } from '~/lib/auth.server';
import { type MelakartaRow, melakartaListMeta, melakartaRows } from '~/lib/hub-lists';
import { MELAKARTA_LINKS } from '~/lib/melakarta-links';
import { generateRagaUrl } from '~/lib/url-slug';
import { titleCaseName } from '~/lib/utils';
import { scriptSessionResolver } from '~/sessions.server';

export const headers: HeadersFunction = ({ loaderHeaders }) => ({
  'Cache-Control': loaderHeaders.get('Cache-Control') ?? PRIVATE_PAGE_CACHE_CONTROL,
});

export const loader: LoaderFunction = async ({ request }) => {
  const script = await scriptSessionResolver.getScript(request);
  const rows = melakartaRows(MELAKARTA_LINKS).map(r => ({
    ...r,
    displayName: titleCaseName(fromItrans(r.name, script)),
    url: generateRagaUrl(r.name, r.id),
  }));
  return data({ rows }, { headers: { 'Cache-Control': await publicPageCacheControl(request) } });
};

export const meta: MetaFunction = () => {
  const { title, description } = melakartaListMeta();
  return [
    { title },
    { name: 'description', content: description },
    { tagName: 'link', rel: 'canonical', href: 'https://rasika.life/carnatic/ragas/melakarta' },
  ];
};

type Row = MelakartaRow & { displayName: string; url: string };

export default function MelakartaList() {
  const { rows } = useLoaderData<{ rows: Row[] }>();
  const chakras = [...new Set(rows.map(r => r.chakra))].map(chakra => ({
    chakra,
    name: rows.find(r => r.chakra === chakra)?.chakraName ?? '',
    melas: rows.filter(r => r.chakra === chakra),
  }));

  return (
    <main className="container mx-auto px-4 py-8 max-w-4xl">
      <header className="mb-8">
        <h1 className="page-title">The 72 Melakarta Ragas</h1>
        <p className="text-xl text-muted-foreground">
          The parent scales of Carnatic music, in order, grouped into 12 chakras. Each has all seven
          swaras in a fixed order. Open a raga for its page. See also the{' '}
          <Link to="/carnatic/ragas/janya" className="text-primary hover:underline">
            janya ragas, by parent melakarta
          </Link>
          .
        </p>
      </header>

      {chakras.map(({ chakra, name, melas }) => (
        <section key={chakra} aria-labelledby={`chakra-${chakra}`} className="mb-8">
          <h2 id={`chakra-${chakra}`} className="text-2xl font-semibold mb-3">
            Chakra {chakra}: {name}
          </h2>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b text-muted-foreground">
                  <th className="py-2 pr-4 font-medium">No.</th>
                  <th className="py-2 pr-4 font-medium">Raga</th>
                  <th className="py-2 font-medium">Arohanam</th>
                </tr>
              </thead>
              <tbody>
                {melas.map(r => (
                  <tr key={r.mela} className="border-b last:border-0">
                    <td className="py-2 pr-4 tabular-nums">{r.mela}</td>
                    <td className="py-2 pr-4">
                      <Link to={r.url} className="text-primary hover:underline">
                        {r.displayName}
                      </Link>
                    </td>
                    <td className="py-2 font-mono">{r.scale}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      ))}
      <BreadcrumbStructuredData
        items={[
          { name: 'Home', item: 'https://rasika.life' },
          { name: 'Carnatic', item: 'https://rasika.life/carnatic' },
          { name: 'Ragas', item: 'https://rasika.life/carnatic/ragas' },
          { name: 'Melakarta ragas', item: 'https://rasika.life/carnatic/ragas/melakarta' },
        ]}
      />
    </main>
  );
}
