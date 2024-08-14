import { CreateEntityItem, Entity, UpdateEntityItem } from 'electrodb';
import KSUID from 'ksuid';

export const Song = new Entity({
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
export type CreateSong = CreateEntityItem<typeof Song>;
export type UpdateSong = UpdateEntityItem<typeof Song>;
