import { CompositionEntity } from './entity';
import { generateId } from '../../utils';
export class CompositionRepository {
    static async create(input) {
        const id = generateId();
        const result = await CompositionEntity.create({ id, ...input }).go();
        if (!result.data) {
            throw new Error('Failed to create composition');
        }
        return result.data;
    }
    static async getById(id) {
        const result = await CompositionEntity.get({ id }).go();
        return result.data || null;
    }
    static async getByArtistId(artistId) {
        const result = await CompositionEntity.query.byArtist({ artistId }).go();
        return result.data;
    }
    static async update(id, input) {
        const result = await CompositionEntity.update({ id }).set(input).go();
        if (!result.data) {
            throw new Error(`Composition ${id} not found`);
        }
        return result.data;
    }
    static async delete(id) {
        await CompositionEntity.delete({ id }).go();
        return true;
    }
}
