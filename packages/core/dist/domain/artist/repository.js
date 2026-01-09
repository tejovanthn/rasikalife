import { ArtistEntity } from './entity';
import { generateId } from '../../utils';
export class ArtistRepository {
    static async create(input) {
        const id = generateId();
        const result = await ArtistEntity.create({ id, ...input }).go();
        if (!result.data) {
            throw new Error('Failed to create artist');
        }
        return result.data;
    }
    static async getById(id) {
        const result = await ArtistEntity.get({ id }).go();
        return result.data || null;
    }
    static async update(id, input) {
        const result = await ArtistEntity.update({ id }).set(input).go();
        if (!result.data) {
            throw new Error(`Artist ${id} not found`);
        }
        return result.data;
    }
    static async delete(id) {
        await ArtistEntity.delete({ id }).go();
        return true;
    }
}
