import { generateId } from '../../utils';
import { TalaEntity } from './entity';
export async function createTala(input) {
    const id = generateId();
    const result = await TalaEntity.create({
        id,
        ...input,
    }).go();
    if (!result.data) {
        throw new Error(`Failed to create tala: ${JSON.stringify(input)}`);
    }
    return result.data;
}
export async function getTala(id) {
    const result = await TalaEntity.get({ id }).go();
    return result.data || null;
}
export async function getTalaByName(name) {
    const result = await TalaEntity.query.byName({ name }).go();
    return result.data?.[0] || null;
}
export async function updateTala(id, input) {
    const result = await TalaEntity.update({ id }).set(input).go();
    if (!result.data) {
        throw new Error(`Tala ${id} not found or update failed`);
    }
    return result.data;
}
export async function deleteTala(id) {
    await TalaEntity.delete({ id }).go();
}
export { CreateTalaSchema, UpdateTalaSchema } from './schema';
