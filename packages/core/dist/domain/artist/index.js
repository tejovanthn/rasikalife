import { generateId } from '../../utils';
import { ArtistEntity } from './entity';
export async function createArtist(input) {
    const id = generateId();
    const result = await ArtistEntity.create({
        id,
        ...input,
        artistType: input.artistType ?? 'Artist',
    }).go();
    if (!result.data) {
        throw new Error(`Failed to create artist: ${JSON.stringify(input)}`);
    }
    return result.data;
}
export async function getArtist(id) {
    const result = await ArtistEntity.get({ id }).go();
    return result.data || null;
}
export async function updateArtist(id, input) {
    const result = await ArtistEntity.update({ id }).set(input).go();
    if (!result.data) {
        throw new Error(`Artist ${id} not found or update failed`);
    }
    return result.data;
}
export async function deleteArtist(id) {
    await ArtistEntity.delete({ id }).go();
}
export { CreateArtistSchema, UpdateArtistSchema } from './schema';
