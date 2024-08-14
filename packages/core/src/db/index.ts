import { DocumentClient } from 'aws-sdk/clients/dynamodb';
import { Service } from 'electrodb';
import { Resource } from 'sst';

import { Content, CreateContent, UpdateContent } from './content';
import { CreateItem, Item, UpdateItem } from './item';
import { CreateSong, Song, UpdateSong } from './song';

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

export const service = new Service(
  { Song, Item, Content },
  {
    client,
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

export const getAllContentPaths = async () => {
  return await Content.query
    .byPath({ path: '/' })
    .go({ attributes: ['path', 'updatedAt'] });
};

export const getContent = async (path: string) => {
  return await Content.get({ path }).go();
};

export const addContent = async (content: CreateContent) => {
  return await Content.put(content).go();
};

export const updateContent = async (path: string, content: UpdateContent) => {
  return await Content.update({ path }).set(content).go();
};
