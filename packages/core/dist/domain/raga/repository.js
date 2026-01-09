import { generateId } from '../../utils';
import { RagaEntity } from './entity';
export class RagaRepository {
    static async create(input) {
        const id = generateId();
        const result = await RagaEntity.create({ id, ...input }).go();
        if (!result.data) {
            throw new Error('Failed to create raga');
        }
        return result.data;
    }
    static async getById(id) {
        const result = await RagaEntity.get({ id }).go();
        return result.data || null;
    }
    static async getByName(name) {
        const result = await RagaEntity.query.byName({ name }).go();
        return result.data[0] || null;
    }
    static async update(id, input) {
        const result = await RagaEntity.update({ id }).set(input).go();
        if (!result.data) {
            throw new Error(`Raga ${id} not found`);
        }
        return result.data;
    }
    static async delete(id) {
        await RagaEntity.delete({ id }).go();
        return true;
    }
}
