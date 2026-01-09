import { Service } from 'electrodb';
import { ArtistEntity } from '../domain/artist/entity';
import { CompositionEntity } from '../domain/composition/entity';
import { RagaEntity } from '../domain/raga/entity';
import { TalaEntity } from '../domain/tala/entity';

export const RasikaLifeService = new Service({
  artist: ArtistEntity,
  composition: CompositionEntity,
  raga: RagaEntity,
  tala: TalaEntity,
});
