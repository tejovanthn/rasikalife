import { type CreateEntityItem, Entity, type UpdateEntityItem } from 'electrodb';
import KSUID from 'ksuid';

export const Item = new Entity({
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
export type CreateItem = Omit<CreateEntityItem<typeof Item>, 'type'>;
export type UpdateItem = Omit<UpdateEntityItem<typeof Item>, 'type'>;
