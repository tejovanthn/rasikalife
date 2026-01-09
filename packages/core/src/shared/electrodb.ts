import { Service } from 'electrodb';
import { ArtistEntity, CompositionEntity } from '../db/entities';

export const RasikaLifeService = new Service({
  artist: ArtistEntity,
  composition: CompositionEntity,
});
