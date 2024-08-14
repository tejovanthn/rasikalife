import { CreateEntityItem, Entity, UpdateEntityItem } from 'electrodb';
import KSUID from 'ksuid';

export const Content = new Entity({
  model: {
    entity: 'Content',
    service: 'Rasika',
    version: '1',
  },
  attributes: {
    id: {
      type: 'string',
      required: true,
      default: () => KSUID.randomSync().string,
    },
    path: { type: 'string', required: true },
    content: { type: 'string', required: true },
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
    byPath: {
      pk: { field: 'pk', composite: ['path'] },
      sk: { field: 'sk', composite: [] },
    },
  },
});
export type CreateContent = Omit<CreateEntityItem<typeof Content>, 'type'>;
export type UpdateContent = Omit<UpdateEntityItem<typeof Content>, 'type'>;
