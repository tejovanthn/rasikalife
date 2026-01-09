import { generateId } from '../../utils';
import { TalaEntity } from './entity';
export class TalaRepository {
    static async create(input) {
        const id = generateId();
        const result = await TalaEntity.create({ id, ...input }).go();
        if (!result.data) {
            throw new Error('Failed to create tala');
        }
        return result.data;
    }
    static async getById(id) {
        const result = await TalaEntity.get({ id }).go();
        return result.data || null;
    }
    static async getByName(name) {
        const result = await TalaEntity.query.byName({ name }).go();
        return result.data[0] || null;
    }
    static async update(id, input) {
        const result = await TalaEntity.update({ id }).set(input).go();
        if (!result.data) {
            throw new Error(`Tala ${id} not found`);
        }
        return result.data;
    }
    static async delete(id) {
        await TalaEntity.delete({ id }).go();
        return true;
    }
}
