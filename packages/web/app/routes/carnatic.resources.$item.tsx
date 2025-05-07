import { type LoaderFunctionArgs, json } from '@remix-run/node';
import { useLoaderData } from '@remix-run/react';
import Markdown from 'react-markdown';
import { client } from '~/api.server';

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const url = new URL(request.url);

  console.log(url.pathname);

  const response = await client.content.byPath.query({ path: url.pathname });
  if (!response.data?.content) {
    throw new Response(null, {
      status: 404,
      statusText: 'Not Found',
    });
  }

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
