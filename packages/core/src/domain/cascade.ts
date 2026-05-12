import { BatchGetCommand, DeleteCommand, UpdateCommand } from '@aws-sdk/lib-dynamodb';
import { TABLE_NAME, dynamoClient } from '../db/client';

export const CASCADE_BATCH_SIZE = 1000;

type Page = { data: unknown[]; cursor: string | null };

async function batchGetCompositions(ids: string[]): Promise<Map<string, Record<string, unknown>>> {
  const map = new Map<string, Record<string, unknown>>();
  if (ids.length === 0) return map;

  const chunks: string[][] = [];
  for (let i = 0; i < ids.length; i += 100) {
    chunks.push(ids.slice(i, i + 100));
  }

  const results = await Promise.all(
    chunks.map(chunk =>
      dynamoClient.send(
        new BatchGetCommand({
          RequestItems: {
            [TABLE_NAME]: {
              Keys: chunk.map(id => ({ pk: `COMPOSITION#${id}`, sk: '#METADATA' })),
            },
          },
        })
      )
    )
  );

  for (const result of results) {
    for (const item of (result.Responses?.[TABLE_NAME] ?? []) as Array<Record<string, unknown>>) {
      map.set((item.pk as string).replace('COMPOSITION#', ''), item);
    }
  }
  return map;
}

export async function cascadeComposerNameUpdate(artistId: string, newName: string): Promise<void> {
  const { CompositionEntity } = await import('./composition/entity');
  const now = new Date().toISOString();

  let cursor: string | null = null;
  do {
    const result = (await CompositionEntity.query
      .byComposer({ composerId: artistId })
      .go({ limit: CASCADE_BATCH_SIZE, cursor })) as Page;
    const items = (result.data as Array<{ id: string }>) || [];
    cursor = result.cursor;

    await Promise.all(
      items.map(item =>
        dynamoClient.send(
          new UpdateCommand({
            TableName: TABLE_NAME,
            Key: { pk: `COMPOSITION#${item.id}`, sk: '#METADATA' },
            UpdateExpression: 'SET composer.#name = :name, updatedAt = :updatedAt',
            ExpressionAttributeNames: { '#name': 'name' },
            ExpressionAttributeValues: { ':name': newName, ':updatedAt': now },
          })
        )
      )
    );
  } while (cursor);
}

export async function cascadeRagaNameUpdate(ragaId: string, newName: string): Promise<void> {
  const { CompositionRagaEntity } = await import('./composition_raga/entity');
  const now = new Date().toISOString();

  let cursor: string | null = null;
  do {
    const result = (await CompositionRagaEntity.query
      .byRaga({ ragaId })
      .go({ limit: CASCADE_BATCH_SIZE, cursor })) as Page;
    const items = (result.data as Array<{ compositionId: string }>) || [];
    cursor = result.cursor;

    if (items.length === 0) continue;

    const compositions = await batchGetCompositions(items.map(item => item.compositionId));

    await Promise.all(
      items.map(item => {
        const composition = compositions.get(item.compositionId);
        if (!composition) return;

        const ragas = composition.ragas as Array<{ id: string; name: string }> | undefined;
        if (!ragas || ragas.length === 0) return;

        const updatedRagas = ragas.map(r => (r.id === ragaId ? { ...r, name: newName } : r));

        return dynamoClient.send(
          new UpdateCommand({
            TableName: TABLE_NAME,
            Key: { pk: `COMPOSITION#${item.compositionId}`, sk: '#METADATA' },
            UpdateExpression: 'SET ragas = :ragas, updatedAt = :updatedAt',
            ExpressionAttributeValues: { ':ragas': updatedRagas, ':updatedAt': now },
          })
        );
      })
    );
  } while (cursor);
}

export async function cascadeVenueNameUpdate(venueId: string, newName: string): Promise<void> {
  const { EventEntity } = await import('./event/entity');
  const now = new Date().toISOString();

  let cursor: string | null = null;
  do {
    const result = (await EventEntity.query
      .byVenue({ venueId })
      .go({ limit: CASCADE_BATCH_SIZE, cursor })) as Page;
    const items = (result.data as Array<{ id: string }>) || [];
    cursor = result.cursor;

    await Promise.all(
      items.map(item =>
        dynamoClient.send(
          new UpdateCommand({
            TableName: TABLE_NAME,
            Key: { pk: `EVENT#${item.id}`, sk: '#METADATA' },
            UpdateExpression: 'SET venueName = :venueName, updatedAt = :updatedAt',
            ExpressionAttributeValues: { ':venueName': newName, ':updatedAt': now },
          })
        )
      )
    );
  } while (cursor);
}

export async function cascadeOrganiserNameUpdate(
  organiserId: string,
  newName: string
): Promise<void> {
  const { EventEntity } = await import('./event/entity');
  const { AwardEntity } = await import('./award/entity');
  const now = new Date().toISOString();

  // Awards are a small set — fetch all at once
  const awardResult = await AwardEntity.query
    .list({})
    .where((attr, op) => op.eq(attr.issuingOrganisationId, organiserId))
    .go({ pages: 'all' });
  const awardItems = (awardResult.data as Array<{ id: string }>) || [];

  await Promise.all(
    awardItems.map(item =>
      dynamoClient.send(
        new UpdateCommand({
          TableName: TABLE_NAME,
          Key: { pk: `AWARD#${item.id}`, sk: '#METADATA' },
          UpdateExpression:
            'SET issuingOrganisationName = :issuingOrganisationName, updatedAt = :updatedAt',
          ExpressionAttributeValues: { ':issuingOrganisationName': newName, ':updatedAt': now },
        })
      )
    )
  );

  let cursor: string | null = null;
  do {
    const eventResult = (await EventEntity.query
      .byOrganiser({ organiserId })
      .go({ limit: CASCADE_BATCH_SIZE, cursor })) as Page;
    const eventItems = (eventResult.data as Array<{ id: string }>) || [];
    cursor = eventResult.cursor;

    await Promise.all(
      eventItems.map(item =>
        dynamoClient.send(
          new UpdateCommand({
            TableName: TABLE_NAME,
            Key: { pk: `EVENT#${item.id}`, sk: '#METADATA' },
            UpdateExpression: 'SET organiserName = :organiserName, updatedAt = :updatedAt',
            ExpressionAttributeValues: { ':organiserName': newName, ':updatedAt': now },
          })
        )
      )
    );
  } while (cursor);
}

export async function cascadeEventMetadataToArtists(
  eventId: string,
  newTitle: string,
  newStartDateTime: string
): Promise<void> {
  const { EventArtistEntity } = await import('./event-artist/entity');

  let cursor: string | null = null;
  do {
    const result = (await EventArtistEntity.query.primary({ eventId }).go({ cursor })) as Page;
    const items = (result.data as Array<{ eventId: string; artistId: string }>) || [];
    cursor = result.cursor;

    await Promise.all(
      items.map(item =>
        dynamoClient.send(
          new UpdateCommand({
            TableName: TABLE_NAME,
            Key: { pk: `EVENT#${item.eventId}`, sk: `ARTIST#${item.artistId}` },
            UpdateExpression:
              'SET eventTitle = :eventTitle, eventStartDateTime = :eventStartDateTime, gsi1sk = :gsi1sk',
            ExpressionAttributeValues: {
              ':eventTitle': newTitle,
              ':eventStartDateTime': newStartDateTime,
              ':gsi1sk': newStartDateTime,
            },
          })
        )
      )
    );
  } while (cursor);
}

export async function cascadeTalaNameUpdate(talaId: string, newName: string): Promise<void> {
  const { CompositionTalaEntity } = await import('./composition_tala/entity');
  const now = new Date().toISOString();

  let cursor: string | null = null;
  do {
    const result = (await CompositionTalaEntity.query
      .byTala({ talaId })
      .go({ limit: CASCADE_BATCH_SIZE, cursor })) as Page;
    const items = (result.data as Array<{ compositionId: string }>) || [];
    cursor = result.cursor;

    if (items.length === 0) continue;

    const compositions = await batchGetCompositions(items.map(item => item.compositionId));

    await Promise.all(
      items.map(item => {
        const composition = compositions.get(item.compositionId);
        if (!composition) return;

        const talas = composition.talas as Array<{ id: string; name: string }> | undefined;
        if (!talas || talas.length === 0) return;

        const updatedTalas = talas.map(t => (t.id === talaId ? { ...t, name: newName } : t));

        return dynamoClient.send(
          new UpdateCommand({
            TableName: TABLE_NAME,
            Key: { pk: `COMPOSITION#${item.compositionId}`, sk: '#METADATA' },
            UpdateExpression: 'SET talas = :talas, updatedAt = :updatedAt',
            ExpressionAttributeValues: { ':talas': updatedTalas, ':updatedAt': now },
          })
        );
      })
    );
  } while (cursor);
}

export async function cascadeArtistMerge(
  loserId: string,
  canonicalId: string,
  canonicalName: string
): Promise<void> {
  const { EventArtistEntity } = await import('./event-artist/entity');
  const { CompositionEntity } = await import('./composition/entity');
  const now = new Date().toISOString();

  // Migrate EventArtist records from loser to canonical
  let eaCursor: string | null = null;
  do {
    const eventArtistResult = (await EventArtistEntity.query
      .byArtist({ artistId: loserId })
      .go({ limit: CASCADE_BATCH_SIZE, cursor: eaCursor })) as Page;
    const eventArtistItems =
      (eventArtistResult.data as Array<{
        eventId: string;
        artistId: string;
        eventTitle: string;
        eventStartDateTime: string;
        artistTitle?: string;
        role?: string;
      }>) || [];
    eaCursor = eventArtistResult.cursor;

    // Batch-check which canonical records already exist (one BatchGet vs N individual GETs)
    const existingResult = eventArtistItems.length
      ? await EventArtistEntity.get(
          eventArtistItems.map(item => ({ eventId: item.eventId, artistId: canonicalId }))
        ).go()
      : { data: [] as Array<{ eventId: string }> };
    const existingSet = new Set((existingResult.data ?? []).map(r => r.eventId));

    await Promise.all(
      eventArtistItems.map(async item => {
        await dynamoClient.send(
          new DeleteCommand({
            TableName: TABLE_NAME,
            Key: { pk: `EVENT#${item.eventId}`, sk: `ARTIST#${loserId}` },
          })
        );
        if (!existingSet.has(item.eventId)) {
          await EventArtistEntity.upsert({
            eventId: item.eventId,
            artistId: canonicalId,
            eventTitle: item.eventTitle,
            eventStartDateTime: item.eventStartDateTime,
            artistName: canonicalName,
            artistTitle: item.artistTitle,
            role: item.role,
          }).go();
        }
      })
    );
  } while (eaCursor);

  // Update Composition.composerId and composer.name
  let compCursor: string | null = null;
  do {
    const compositionResult = (await CompositionEntity.query
      .byComposer({ composerId: loserId })
      .go({ limit: CASCADE_BATCH_SIZE, cursor: compCursor })) as Page;
    const compositionItems = (compositionResult.data as Array<{ id: string }>) || [];
    compCursor = compositionResult.cursor;

    await Promise.all(
      compositionItems.map(item =>
        dynamoClient.send(
          new UpdateCommand({
            TableName: TABLE_NAME,
            Key: { pk: `COMPOSITION#${item.id}`, sk: '#METADATA' },
            UpdateExpression:
              'SET composerId = :composerId, composer.id = :composerId, composer.#name = :name, gsi2pk = :gsi2pk, updatedAt = :updatedAt',
            ExpressionAttributeNames: { '#name': 'name' },
            ExpressionAttributeValues: {
              ':composerId': canonicalId,
              ':name': canonicalName,
              ':gsi2pk': `ARTIST#${canonicalId}`,
              ':updatedAt': now,
            },
          })
        )
      )
    );
  } while (compCursor);
}

export async function cascadeVenueMerge(
  loserId: string,
  canonicalId: string,
  canonicalName: string
): Promise<void> {
  const { EventEntity } = await import('./event/entity');
  const now = new Date().toISOString();

  let cursor: string | null = null;
  do {
    const result = (await EventEntity.query
      .byVenue({ venueId: loserId })
      .go({ limit: CASCADE_BATCH_SIZE, cursor })) as Page;
    const items = (result.data as Array<{ id: string }>) || [];
    cursor = result.cursor;

    await Promise.all(
      items.map(item =>
        dynamoClient.send(
          new UpdateCommand({
            TableName: TABLE_NAME,
            Key: { pk: `EVENT#${item.id}`, sk: '#METADATA' },
            UpdateExpression:
              'SET venueId = :venueId, venueName = :venueName, gsi4pk = :gsi4pk, updatedAt = :updatedAt',
            ExpressionAttributeValues: {
              ':venueId': canonicalId,
              ':venueName': canonicalName,
              ':gsi4pk': `VENUE#${canonicalId}`,
              ':updatedAt': now,
            },
          })
        )
      )
    );
  } while (cursor);
}

export async function cascadeOrganiserMerge(
  loserId: string,
  canonicalId: string,
  canonicalName: string
): Promise<void> {
  const { EventEntity } = await import('./event/entity');
  const now = new Date().toISOString();

  let cursor: string | null = null;
  do {
    const result = (await EventEntity.query
      .byOrganiser({ organiserId: loserId })
      .go({ limit: CASCADE_BATCH_SIZE, cursor })) as Page;
    const items = (result.data as Array<{ id: string }>) || [];
    cursor = result.cursor;

    await Promise.all(
      items.map(item =>
        dynamoClient.send(
          new UpdateCommand({
            TableName: TABLE_NAME,
            Key: { pk: `EVENT#${item.id}`, sk: '#METADATA' },
            UpdateExpression:
              'SET organiserId = :organiserId, organiserName = :organiserName, gsi5pk = :gsi5pk, updatedAt = :updatedAt',
            ExpressionAttributeValues: {
              ':organiserId': canonicalId,
              ':organiserName': canonicalName,
              ':gsi5pk': `ORGANISER#${canonicalId}`,
              ':updatedAt': now,
            },
          })
        )
      )
    );
  } while (cursor);
}

export async function cascadeRagaMerge(
  loserId: string,
  canonicalId: string,
  canonicalName: string
): Promise<void> {
  const { CompositionRagaEntity } = await import('./composition_raga/entity');
  const now = new Date().toISOString();

  let cursor: string | null = null;
  do {
    const result = (await CompositionRagaEntity.query
      .byRaga({ ragaId: loserId })
      .go({ limit: CASCADE_BATCH_SIZE, cursor })) as Page;
    const items = (result.data as Array<{ compositionId: string }>) || [];
    cursor = result.cursor;

    if (items.length === 0) continue;

    const compositions = await batchGetCompositions(items.map(item => item.compositionId));

    // Batch-check which canonical raga junctions already exist
    const existingRagaResult = items.length
      ? await CompositionRagaEntity.get(
          items.map(item => ({ compositionId: item.compositionId, ragaId: canonicalId }))
        ).go()
      : { data: [] as Array<{ compositionId: string }> };
    const existingRagaSet = new Set((existingRagaResult.data ?? []).map(r => r.compositionId));

    await Promise.all(
      items.map(async item => {
        const { compositionId } = item;

        // Replace CompositionRaga junction: delete loser, upsert canonical (skip if already exists)
        await dynamoClient.send(
          new DeleteCommand({
            TableName: TABLE_NAME,
            Key: { pk: `COMPOSITION#${compositionId}`, sk: `RAGA#${loserId}` },
          })
        );
        if (!existingRagaSet.has(compositionId)) {
          await CompositionRagaEntity.create({ compositionId, ragaId: canonicalId }).go();
        }

        // Update denormalized ragas array in Composition
        const composition = compositions.get(compositionId);
        if (!composition) return;

        const ragas = composition.ragas as Array<{ id: string; name: string }> | undefined;
        if (!ragas) return;

        const filtered = ragas.filter(r => r.id !== loserId);
        const hasCanonical = filtered.some(r => r.id === canonicalId);
        const updatedRagas = hasCanonical
          ? filtered.map(r => (r.id === canonicalId ? { id: canonicalId, name: canonicalName } : r))
          : [...filtered, { id: canonicalId, name: canonicalName }];

        await dynamoClient.send(
          new UpdateCommand({
            TableName: TABLE_NAME,
            Key: { pk: `COMPOSITION#${compositionId}`, sk: '#METADATA' },
            UpdateExpression: 'SET ragas = :ragas, updatedAt = :updatedAt',
            ExpressionAttributeValues: { ':ragas': updatedRagas, ':updatedAt': now },
          })
        );
      })
    );
  } while (cursor);
}

export async function cascadeTalaMerge(
  loserId: string,
  canonicalId: string,
  canonicalName: string
): Promise<void> {
  const { CompositionTalaEntity } = await import('./composition_tala/entity');
  const now = new Date().toISOString();

  let cursor: string | null = null;
  do {
    const result = (await CompositionTalaEntity.query
      .byTala({ talaId: loserId })
      .go({ limit: CASCADE_BATCH_SIZE, cursor })) as Page;
    const items = (result.data as Array<{ compositionId: string }>) || [];
    cursor = result.cursor;

    if (items.length === 0) continue;

    const compositions = await batchGetCompositions(items.map(item => item.compositionId));

    // Batch-check which canonical tala junctions already exist
    const existingTalaResult = items.length
      ? await CompositionTalaEntity.get(
          items.map(item => ({ compositionId: item.compositionId, talaId: canonicalId }))
        ).go()
      : { data: [] as Array<{ compositionId: string }> };
    const existingTalaSet = new Set((existingTalaResult.data ?? []).map(t => t.compositionId));

    await Promise.all(
      items.map(async item => {
        const { compositionId } = item;

        // Replace CompositionTala junction: delete loser, upsert canonical
        await dynamoClient.send(
          new DeleteCommand({
            TableName: TABLE_NAME,
            Key: { pk: `COMPOSITION#${compositionId}`, sk: `TALA#${loserId}` },
          })
        );
        if (!existingTalaSet.has(compositionId)) {
          await CompositionTalaEntity.create({ compositionId, talaId: canonicalId }).go();
        }

        // Update denormalized talas array in Composition
        const composition = compositions.get(compositionId);
        if (!composition) return;

        const talas = composition.talas as Array<{ id: string; name: string }> | undefined;
        if (!talas) return;

        const filtered = talas.filter(t => t.id !== loserId);
        const hasCanonical = filtered.some(t => t.id === canonicalId);
        const updatedTalas = hasCanonical
          ? filtered.map(t => (t.id === canonicalId ? { id: canonicalId, name: canonicalName } : t))
          : [...filtered, { id: canonicalId, name: canonicalName }];

        await dynamoClient.send(
          new UpdateCommand({
            TableName: TABLE_NAME,
            Key: { pk: `COMPOSITION#${compositionId}`, sk: '#METADATA' },
            UpdateExpression: 'SET talas = :talas, updatedAt = :updatedAt',
            ExpressionAttributeValues: { ':talas': updatedTalas, ':updatedAt': now },
          })
        );
      })
    );
  } while (cursor);
}

export async function cascadeEventMerge(loserId: string, canonicalId: string): Promise<void> {
  const { EventArtistEntity } = await import('./event-artist/entity');

  // Collect all canonical artists across all pages
  const canonicalArtistIds = new Set<string>();
  let canonicalCursor: string | null = null;
  do {
    const canonicalResult = (await EventArtistEntity.query
      .primary({ eventId: canonicalId })
      .go({ limit: CASCADE_BATCH_SIZE, cursor: canonicalCursor })) as Page;
    for (const a of canonicalResult.data as Array<{ artistId: string }>) {
      canonicalArtistIds.add(a.artistId);
    }
    canonicalCursor = canonicalResult.cursor;
  } while (canonicalCursor);

  // Get canonical event data for denormalized fields
  const { EventEntity } = await import('./event/entity');
  const canonicalEvent = await EventEntity.get({ id: canonicalId }).go();
  const canonicalTitle = canonicalEvent.data?.title ?? '';
  const canonicalStartDateTime = canonicalEvent.data?.startDateTime ?? '';

  // Migrate loser artists to canonical
  let loserCursor: string | null = null;
  do {
    const loserResult = (await EventArtistEntity.query
      .primary({ eventId: loserId })
      .go({ limit: CASCADE_BATCH_SIZE, cursor: loserCursor })) as Page;
    const loserItems =
      (loserResult.data as Array<{
        eventId: string;
        artistId: string;
        eventTitle: string;
        eventStartDateTime: string;
        artistName: string;
        artistTitle?: string;
        role?: string;
      }>) || [];
    loserCursor = loserResult.cursor;

    await Promise.all(
      loserItems.map(async item => {
        await dynamoClient.send(
          new DeleteCommand({
            TableName: TABLE_NAME,
            Key: { pk: `EVENT#${loserId}`, sk: `ARTIST#${item.artistId}` },
          })
        );
        if (!canonicalArtistIds.has(item.artistId)) {
          await EventArtistEntity.upsert({
            eventId: canonicalId,
            artistId: item.artistId,
            eventTitle: canonicalTitle,
            eventStartDateTime: canonicalStartDateTime,
            artistName: item.artistName,
            artistTitle: item.artistTitle,
            role: item.role,
          }).go();
          canonicalArtistIds.add(item.artistId);
        }
      })
    );
  } while (loserCursor);
}
