# Service Functions for tRPC Server Implementation

## ArtistService

```typescript
// Artist Management
createArtist(input: CreateArtistInput): Promise<Artist>
getArtist(id: string): Promise<Artist | null>
updateArtist(id: string, input: UpdateArtistInput): Promise<Artist>
searchArtists(params: ArtistSearchParams): Promise<ArtistSearchResult>
getPopularArtists(limit?: number): Promise<Artist[]>
incrementViewCount(id: string): Promise<void>
```

## RagaService

```typescript
// Raga Management
createRaga(input: CreateRagaInput): Promise<Raga>
getRaga(id: string, version?: string): Promise<Raga | null>
getRagaByName(name: string): Promise<Raga | null>
updateRaga(id: string, input: UpdateRagaInput): Promise<Raga>
searchRagas(params: RagaSearchParams): Promise<RagaSearchResult>
getVersionHistory(id: string): Promise<RagaVersion[]>
incrementViewCount(id: string): Promise<void>
```

## TalaService

```typescript
// Tala Management
createTala(input: CreateTalaInput): Promise<Tala>
getTala(id: string, version?: string): Promise<Tala | null>
getTalaByName(name: string): Promise<Tala | null>
updateTala(id: string, input: UpdateTalaInput): Promise<Tala>
searchTalas(params: TalaSearchParams): Promise<TalaSearchResult>
getVersionHistory(id: string): Promise<TalaVersion[]>
incrementViewCount(id: string): Promise<void>
```

## CompositionService

```typescript
// Composition Management
createComposition(input: CreateCompositionInput): Promise<Composition>
getComposition(id: string, version?: string): Promise<Composition | null>
getCompositionWithAttributions(id: string): Promise<CompositionWithAttributions | null>
updateComposition(id: string, input: UpdateCompositionInput): Promise<Composition>
getVersionHistory(id: string): Promise<CompositionVersion[]>
searchCompositions(params: CompositionSearchParams): Promise<CompositionSearchResult>
incrementViewCount(id: string): Promise<void>

// Attribution Management
createAttribution(input: CreateAttributionInput): Promise<CompositionAttribution>
updateAttribution(input: UpdateAttributionInput): Promise<CompositionAttribution>
getAttribution(compositionId: string, artistId: string): Promise<CompositionAttribution | null>
searchAttributions(params: AttributionSearchParams): Promise<AttributionSearchResult>
verifyAttribution(compositionId: string, artistId: string, userId: string): Promise<CompositionAttribution>
```

## Search Parameter Types

```typescript
// Search Parameter Types
interface ArtistSearchParams {
  query?: string;
  instrument?: string;
  tradition?: Tradition;
  location?: { country?: string; state?: string; city?: string; };
  limit?: number;
  nextToken?: string;
}

interface RagaSearchParams {
  query?: string;
  melakarta?: number;
  tradition?: Tradition;
  limit?: number;
  nextToken?: string;
}

interface TalaSearchParams {
  query?: string;
  aksharas?: number;
  type?: string;
  tradition?: Tradition;
  limit?: number;
  nextToken?: string;
}

interface CompositionSearchParams {
  query?: string;
  ragaId?: string;
  talaId?: string;
  artistId?: string;
  language?: string;
  tradition?: Tradition;
  limit?: number;
  nextToken?: string;
}

interface AttributionSearchParams {
  compositionId?: string;
  artistId?: string;
  attributionType?: AttributionType;
  limit?: number;
  nextToken?: string;
}
```

These function signatures can be directly mapped to tRPC procedure definitions, grouping them by domain and functionality. Each service provides a clean, consistent API that abstracts away the database operations while providing business logic.