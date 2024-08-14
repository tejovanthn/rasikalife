import { LoaderFunctionArgs, json } from '@remix-run/node';
import { useLoaderData } from '@remix-run/react';
import Markdown from 'react-markdown';
import { SitemapFunction } from 'remix-sitemap';
import { serverOnly$ } from 'vite-env-only/macros';
import { client } from '~/api.server';

export const sitemap: SitemapFunction = serverOnly$(async () => {
  const list: { loc: string; lastmod: string }[] = [];
  const allPaths = await client.content.allPaths.query();

  allPaths.data.forEach(({ path, updatedAt }) => {
    list.push({
      loc: path,
      lastmod: new Date(updatedAt).toISOString(),
    });
  });

  return list;
});

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const url = new URL(request.url);

  const response = await client.content.byPath.query({ path: url.pathname });
  if (!response.data?.content) {
    throw new Response(null, {
      status: 404,
      statusText: 'Not Found',
    });
  }
  console.log(url);

  return json({ content: response.data?.content });
};

export default function CatchAll() {
  const data = useLoaderData<typeof loader>();

  return (
    <div className="prose container mx-auto">
      <Markdown>{data.content}</Markdown>
    </div>
  );
}
