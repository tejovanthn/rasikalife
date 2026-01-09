import { generateId } from '../../utils';
import { CompositionEntity } from './entity';
export async function createComposition(input) {
    const id = generateId();
    const result = await CompositionEntity.create({ id, ...input }).go();
    if (!result.data) {
        throw new Error('Failed to create composition');
    }
    return result.data;
}
export async function getComposition(id) {
    const result = await CompositionEntity.get({ id }).go();
    return result.data || null;
}
export async function getCompositionsByArtist(artistId) {
    const result = await CompositionEntity.query.byArtist({ artistId }).go();
    return result.data || [];
}
export async function updateComposition(id, input) {
    const result = await CompositionEntity.update({ id }).set(input).go();
    if (!result.data) {
        throw new Error(`Composition ${id} not found`);
    }
    return result.data;
}
export async function deleteComposition(id) {
    await CompositionEntity.delete({ id }).go();
}
// Schemas
export { CreateCompositionSchema, UpdateCompositionSchema, } from './schema';
