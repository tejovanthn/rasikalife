import { generateId } from '../../utils';
import { RagaEntity } from './entity';
export async function createRaga(input) {
    const id = generateId();
    const result = await RagaEntity.create({
        id,
        ...input,
    }).go();
    if (!result.data) {
        throw new Error(`Failed to create raga: ${JSON.stringify(input)}`);
    }
    return result.data;
}
export async function getRaga(id) {
    const result = await RagaEntity.get({ id }).go();
    return result.data || null;
}
export async function getRagaByName(name) {
    const result = await RagaEntity.query.byName({ name }).go();
    return result.data?.[0] || null;
}
export async function updateRaga(id, input) {
    const result = await RagaEntity.update({ id }).set(input).go();
    if (!result.data) {
        throw new Error(`Raga ${id} not found or update failed`);
    }
    return result.data;
}
export async function deleteRaga(id) {
    await RagaEntity.delete({ id }).go();
}
export { CreateRagaSchema, UpdateRagaSchema } from './schema';
