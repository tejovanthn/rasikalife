import type { Params } from '@remix-run/react';
import { client } from '~/api.server';

export const handleItemTypes = ({ params }: { params: Params }) => {
  if (!params.item || !['ragas', 'talas', 'languages', 'composers'].includes(params.item)) {
    throw new Response(null, {
      status: 404,
      statusText: 'Not Found',
    });
  }
};

export const clientMap = {
  ragas: client.ragas,
  talas: client.talas,
  languages: client.languages,
  composers: client.composers,
  songs: {
    ragas: client.songs.byRaga,
    talas: client.songs.byTala,
    languages: client.songs.byLanguage,
    composers: client.songs.byComposer,
  },
};
