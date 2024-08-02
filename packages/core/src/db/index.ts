import { DocumentClient } from 'aws-sdk/clients/dynamodb';
import { CreateEntityItem, Entity, Service, UpdateEntityItem } from 'electrodb';
import KSUID from 'ksuid';
import { Resource } from 'sst';

/** Access pattern:
* [ ] Given song name, show song and details
* [ ] Given a ragas/talas/language/composers, show all songs associated
* [ ] Given starting letter, show all songs/ragas/talas/language/composers starting with that letter

* [ ] Given a query string, show all fuzzy matches for song titles, ragas, composers

* [ ] Show most popular 10 songs
* [ ] Show most popular 10 ragas
* [ ] Set/Unset favourite item
* [ ] Show all favourited items by user
*/

const table = Resource.RasikaTable.name;
const client = new DocumentClient({
  region: 'us-east-1',
});

const Song = new Entity({
  model: {
    entity: 'Song',
    service: 'Rasika',
    version: '1',
  },
  attributes: {
    id: {
      type: 'string',
      required: true,
      default: () => KSUID.randomSync().string,
    },
    name: { type: 'string', required: true },
    slug: {
      type: 'string',
      watch: ['name'],
      set: (_, { name }) => {
        return name.toLowerCase().replace(/ /g, '-');
      },
    },
    lyrics: { type: 'string', required: true },
    notation: { type: 'string', required: false },
    otherInfo: { type: 'string', required: false },
    source: { type: 'string', required: true },

    raga: { type: 'string', required: false },
    tala: { type: 'string', required: false },
    composer: { type: 'string', required: false },
    language: { type: 'string', required: false },

    views: { type: 'number', required: true, default: 0 },

    createdAt: {
      type: 'number',
      readOnly: true,
      required: true,
      default: () => Date.now(),
      set: () => Date.now(),
    },
    updatedAt: {
      type: 'number',
      watch: '*',
      required: true,
      default: () => Date.now(),
      set: () => Date.now(),
    },
  },
  indexes: {
    byId: {
      pk: { field: 'pk', composite: ['id'] },
      sk: { field: 'sk', composite: [] },
    },
    byName: {
      index: 'GSI1',
      pk: { field: 'gsi1pk', composite: [] },
      sk: { field: 'gsi1sk', composite: ['name'] },
    },
    byRaga: {
      index: 'GSI2',
      pk: { field: 'gsi2pk', composite: ['raga'] },
      sk: { field: 'gsi2sk', composite: [] },
    },
    byTala: {
      index: 'GSI3',
      pk: { field: 'gsi3pk', composite: ['tala'] },
      sk: { field: 'gsi3sk', composite: [] },
    },
    byComposer: {
      index: 'GSI4',
      pk: { field: 'gsi4pk', composite: ['composer'] },
      sk: { field: 'gsi4sk', composite: [] },
    },
    byLanguage: {
      index: 'GSI5',
      pk: { field: 'gsi5pk', composite: ['language'] },
      sk: { field: 'gsi5sk', composite: [] },
    },
    byViews: {
      index: 'GSI6',
      pk: { field: 'gsi6pk', composite: [] },
      sk: { field: 'gsi6sk', composite: ['views', 'id'] },
    },
  },
});
type CreateSong = CreateEntityItem<typeof Song>;
type UpdateSong = UpdateEntityItem<typeof Song>;

const Item = new Entity({
  model: {
    entity: 'Item',
    service: 'Rasika',
    version: '1',
  },
  attributes: {
    id: {
      type: 'string',
      required: true,
      default: () => KSUID.randomSync().string,
    },
    type: {
      type: ['raga', 'tala', 'composer', 'language'] as const,
      required: true,
    },
    name: { type: 'string', required: true },
    description: { type: 'string', required: false },

    views: { type: 'number', required: true, default: 0 },

    createdAt: {
      type: 'number',
      readOnly: true,
      required: true,
      default: () => Date.now(),
      set: () => Date.now(),
    },
    updatedAt: {
      type: 'number',
      watch: '*',
      required: true,
      default: () => Date.now(),
      set: () => Date.now(),
    },
  },
  indexes: {
    // byId: {
    //   pk: { field: "pk", composite: ["id"] },
    //   sk: { field: "sk", composite: [] },
    // },
    byTypeAndName: {
      // index: "GSI1",
      pk: { field: 'pk', composite: ['type'] },
      sk: { field: 'sk', composite: ['name'] },
    },
    byViews: {
      index: 'GSI6',
      pk: { field: 'gsi6pk', composite: ['type'] },
      sk: { field: 'gsi6sk', composite: ['views', 'id'] },
    },
  },
});
type CreateItem = Omit<CreateEntityItem<typeof Item>, 'type'>;
type UpdateItem = Omit<UpdateEntityItem<typeof Item>, 'type'>;

export const service = new Service(
  { Song, Item },
  {
    client, // <----- client
    table,
  },
);

export const getSongById = async (id: string) => {
  return await Song.query.byId({ id }).go();
};

export const getSongByName = async (name: string) => {
  return await Song.query.byName({ name }).go();
};

export const getSongByStartingLetter = async (name: string) => {
  return await Song.query.byName({}).begins({ name }).go();
};

export const getSongByRaga = async (raga: string) => {
  return await Song.query.byRaga({ raga }).go();
};

export const getSongByTala = async (tala: string) => {
  return await Song.query.byTala({ tala }).go();
};

export const getSongByComposer = async (composer: string) => {
  return await Song.query.byComposer({ composer }).go();
};

export const getSongByLanguage = async (language: string) => {
  return await Song.query.byLanguage({ language }).go();
};

export const getRagaByName = async (name: string) => {
  return await Item.query.byTypeAndName({ type: 'raga', name }).go();
};

export const getRagaByStartingLetter = async (name: string) => {
  return await Item.query.byTypeAndName({ type: 'raga' }).begins({ name }).go();
};

export const getTalaByName = async (name: string) => {
  return await Item.query.byTypeAndName({ type: 'tala', name }).go();
};

export const getTalaByStartingLetter = async (name: string) => {
  return await Item.query.byTypeAndName({ type: 'tala' }).begins({ name }).go();
};

export const getComposerByName = async (name: string) => {
  return await Item.query.byTypeAndName({ type: 'composer', name }).go();
};

export const getComposerByStartingLetter = async (name: string) => {
  return await Item.query
    .byTypeAndName({ type: 'composer' })
    .begins({ name })
    .go();
};

export const getLanguageByName = async (name: string) => {
  return await Item.query.byTypeAndName({ type: 'language', name }).go();
};

export const getLanguageByStartingLetter = async (name: string) => {
  return await Item.query
    .byTypeAndName({ type: 'language' })
    .begins({ name })
    .go();
};

export const addSong = async (song: CreateSong) => {
  return await Song.put(song).go();
};

export const updateSong = async (id: string, song: UpdateSong) => {
  return await Song.update({ id }).set(song).go();
};

export const addRaga = async (item: CreateItem) => {
  return await Item.put({ ...item, type: 'raga' }).go();
};

export const updateRaga = async (name: string, item: UpdateItem) => {
  return await Item.update({ name, type: 'raga' }).set(item).go();
};

export const addTala = async (item: CreateItem) => {
  return await Item.put({ ...item, type: 'tala' }).go();
};

export const updateTala = async (name: string, item: UpdateItem) => {
  return await Item.update({ name, type: 'tala' }).set(item).go();
};

export const addComposer = async (item: CreateItem) => {
  return await Item.put({ ...item, type: 'composer' }).go();
};

export const updateComposer = async (name: string, composer: UpdateItem) => {
  return await Item.update({ name, type: 'composer' }).set(composer).go();
};

export const addLanguage = async (item: CreateItem) => {
  return await Item.put({ ...item, type: 'language' }).go();
};

export const updateLanguage = async (name: string, language: UpdateItem) => {
  return await Item.update({ name, type: 'language' }).set(language).go();
};

export const updateSongView = async (id: string) => {
  return await Song.update({ id }).add({ views: 1 }).go();
};

export const updateItemView = async ({
  type,
  name,
}: {
  type: 'raga' | 'tala' | 'composer' | 'language';
  name: string;
}) => {
  return await Item.update({ name, type }).add({ views: 1 }).go();
};

export const getTop10Songs = async () => {
  return await Song.query
    .byViews({})
    .go({ limit: 10, order: 'desc', attributes: ['id', 'name'] });
};

export const getTop10Ragas = async () => {
  return await Item.query
    .byViews({ type: 'raga' })
    .go({ limit: 10, order: 'desc', attributes: ['id', 'name'] });
};
