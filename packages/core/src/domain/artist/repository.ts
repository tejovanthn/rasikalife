import { ArtistEntity } from '../../db/entities';
import { generateId } from '../../utils';
import type { Artist, CreateArtistInput, UpdateArtistInput } from './types';

export class ArtistRepository {
  static async create(input: CreateArtistInput): Promise<Artist> {
    const id = generateId();
    const result = await ArtistEntity.create({ id, ...input }).go();

    if (!result.data) {
      throw new Error('Failed to create artist');
    }

    return result.data as Artist;
  }

  static async getById(id: string): Promise<Artist | null> {
    const result = await ArtistEntity.get({ id }).go();
    return result.data || null;
  }

  static async update(id: string, input: UpdateArtistInput): Promise<Artist> {
    const result = await ArtistEntity.update({ id }).set(input).go();

    if (!result.data) {
      throw new Error(`Artist ${id} not found`);
    }

    return result.data as Artist;
  }

  static async delete(id: string): Promise<boolean> {
    await ArtistEntity.delete({ id }).go();
    return true;
  }
}
