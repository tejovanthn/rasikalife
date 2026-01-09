import { CompositionEntity } from '../../db/entities';
import { generateId } from '../../utils';
import type { Composition, CreateCompositionInput, UpdateCompositionInput } from './types';

export class CompositionRepository {
  static async create(input: CreateCompositionInput): Promise<Composition> {
    const id = generateId();
    const result = await CompositionEntity.create({ id, ...input }).go();

    if (!result.data) {
      throw new Error('Failed to create composition');
    }

    return result.data as Composition;
  }

  static async getById(id: string): Promise<Composition | null> {
    const result = await CompositionEntity.get({ id }).go();
    return result.data || null;
  }

  static async getByArtistId(artistId: string): Promise<Composition[]> {
    const result = await CompositionEntity.query.byArtist({ artistId }).go();
    return result.data;
  }

  static async update(id: string, input: UpdateCompositionInput): Promise<Composition> {
    const result = await CompositionEntity.update({ id }).set(input).go();

    if (!result.data) {
      throw new Error(`Composition ${id} not found`);
    }

    return result.data as Composition;
  }

  static async delete(id: string): Promise<boolean> {
    await CompositionEntity.delete({ id }).go();
    return true;
  }
}
