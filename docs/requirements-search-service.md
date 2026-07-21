# Requirements Document: Fuse.js Search Service

## Original Requirements

Use fusejs to create a lambda based service for search. Periodically scan (every 6 hours, using SST.dev's cron) and store a json of artist names, raga names, tala names, composition names, and composition lyrics. Feed this to the fusejs lambda to create a makeshift "opensearch" service. The search needs to be unified with equal weightage for all components, and should also have filters enabled - for example, the api should be able to request for a search term in only lyrics or raga+composition names etc. This will be integrated with the frontend via the trpc server.

## Clarifications (from Q&A)

### Data Source
- **Source**: Existing repositories (ArtistRepository, CompositionRepository, RagaRepository, TalaRepository)
- **Data to index**:
  - Artist names
  - Raga names
  - Tala names
  - Composition titles
  - Composition lyrics (lyricsV1 field with structured lyrics)

### Search Behavior
- **Type**: Fuzzy matching with typo tolerance (fuse.js default behavior)
- **Index size**: Medium dataset (estimated 10k-100k items), should fit in memory for fuse.js

### Filter API
- **Interface**: Structured input using arrays in trpc input (not query params or boolean flags)
- **Filterable fields**: artistName, ragaName, talaName, compositionTitle, lyrics

### API Response
- **Format**: Full results with search scores and highlights
- **Structure**: Should include matched item, score, and highlighted matches per field

## Technical Constraints

- Must use SST.dev for infrastructure (Lambda + Cron)
- Must integrate with existing trpc server
- Must follow existing codebase patterns (ElectroDB, Zod validation, etc.)
- Cron runs every 6 hours
- Index should be rebuilt on each cron execution

## Expected Outputs

1. **Search Lambda**: Handles search requests via API Gateway
2. **Cron Job**: Scans DynamoDB every 6 hours, builds and stores search index
3. **TRPC Router**: Exposes search functionality to frontend
4. **Index Storage**: S3 bucket or DynamoDB table to store the search index JSON

## Non-Requirements

- Real-time index updates (6-hour refresh is acceptable)
- Advanced features like autocomplete, faceted search, or pagination
- Search analytics or query logging
- Multi-language search support
