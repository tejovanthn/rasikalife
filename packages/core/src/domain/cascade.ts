import { DeleteCommand, UpdateCommand } from '@aws-sdk/lib-dynamodb';
import { TABLE_NAME, dynamoClient } from '../db/client';

export const CASCADE_BATCH_SIZE = 1000;

export async function cascadeComposerNameUpdate(artistId: string, newName: string): Promise<void> {
  const { CompositionEntity } = await import('./composition/entity');

  const result = await CompositionEntity.query
    .byComposer({ composerId: artistId })
    .go({ limit: CASCADE_BATCH_SIZE });
  const items = (result.data as Array<{ id: string }>) || [];
  const now = new Date().toISOString();

  await Promise.all(
    items.map(item =>
      dynamoClient.send(
        new UpdateCommand({
          TableName: TABLE_NAME,
          Key: {
            pk: `COMPOSITION#${item.id}`,
            sk: '#METADATA',
          },
          UpdateExpression: 'SET composer.#name = :name, updatedAt = :updatedAt',
          ExpressionAttributeNames: { '#name': 'name' },
          ExpressionAttributeValues: { ':name': newName, ':updatedAt': now },
        })
      )
    )
  );
}

export async function cascadeRagaNameUpdate(ragaId: string, newName: string): Promise<void> {
  const { CompositionRagaEntity } = await import('./composition_raga/entity');
  const { CompositionEntity } = await import('./composition/entity');

  const result = await CompositionRagaEntity.query
    .byRaga({ ragaId })
    .go({ limit: CASCADE_BATCH_SIZE });
  const items = (result.data as Array<{ compositionId: string }>) || [];
  const now = new Date().toISOString();

  await Promise.all(
    items.map(async item => {
      const composition = await CompositionEntity.get({ id: item.compositionId }).go();
      if (!composition.data) return;

      const ragas = composition.data.ragas as Array<{ id: string; name: string }> | undefined;
      if (!ragas || ragas.length === 0) return;

      const updatedRagas = ragas.map(r => (r.id === ragaId ? { ...r, name: newName } : r));

      await dynamoClient.send(
        new UpdateCommand({
          TableName: TABLE_NAME,
          Key: {
            pk: `COMPOSITION#${item.compositionId}`,
            sk: '#METADATA',
          },
          UpdateExpression: 'SET ragas = :ragas, updatedAt = :updatedAt',
          ExpressionAttributeValues: { ':ragas': updatedRagas, ':updatedAt': now },
        })
      );
    })
  );
}

export async function cascadeVenueNameUpdate(venueId: string, newName: string): Promise<void> {
  const { EventEntity } = await import('./event/entity');

  const result = await EventEntity.query.byVenue({ venueId }).go({ limit: CASCADE_BATCH_SIZE });
  const items = (result.data as Array<{ id: string }>) || [];
  const now = new Date().toISOString();

  await Promise.all(
    items.map(item =>
      dynamoClient.send(
        new UpdateCommand({
          TableName: TABLE_NAME,
          Key: {
            pk: `EVENT#${item.id}`,
            sk: '#METADATA',
          },
          UpdateExpression: 'SET venueName = :venueName, updatedAt = :updatedAt',
          ExpressionAttributeValues: { ':venueName': newName, ':updatedAt': now },
        })
      )
    )
  );
}

export async function cascadeOrganiserNameUpdate(
  organiserId: string,
  newName: string
): Promise<void> {
  const { EventEntity } = await import('./event/entity');
  const { AwardEntity } = await import('./award/entity');

  const now = new Date().toISOString();

  const [eventResult, awardResult] = await Promise.all([
    EventEntity.query.byOrganiser({ organiserId }).go({ limit: CASCADE_BATCH_SIZE }),
    AwardEntity.query
      .list({})
      .where((attr, op) => op.eq(attr.issuingOrganisationId, organiserId))
      .go({ pages: 'all' }),
  ]);

  const eventItems = (eventResult.data as Array<{ id: string }>) || [];
  const awardItems = (awardResult.data as Array<{ id: string }>) || [];

  await Promise.all([
    ...eventItems.map(item =>
      dynamoClient.send(
        new UpdateCommand({
          TableName: TABLE_NAME,
          Key: {
            pk: `EVENT#${item.id}`,
            sk: '#METADATA',
          },
          UpdateExpression: 'SET organiserName = :organiserName, updatedAt = :updatedAt',
          ExpressionAttributeValues: { ':organiserName': newName, ':updatedAt': now },
        })
      )
    ),
    ...awardItems.map(item =>
      dynamoClient.send(
        new UpdateCommand({
          TableName: TABLE_NAME,
          Key: {
            pk: `AWARD#${item.id}`,
            sk: '#METADATA',
          },
          UpdateExpression: 'SET issuingOrganisationName = :issuingOrganisationName, updatedAt = :updatedAt',
          ExpressionAttributeValues: { ':issuingOrganisationName': newName, ':updatedAt': now },
        })
      )
    ),
  ]);
}

export async function cascadeEventMetadataToArtists(
  eventId: string,
  newTitle: string,
  newStartDateTime: string
): Promise<void> {
  const { EventArtistEntity } = await import('./event-artist/entity');

  const result = await EventArtistEntity.query.primary({ eventId }).go();
  const items = (result.data as Array<{ eventId: string; artistId: string }>) || [];
  const now = new Date().toISOString();

  await Promise.all(
    items.map(item =>
      dynamoClient.send(
        new UpdateCommand({
          TableName: TABLE_NAME,
          Key: {
            pk: `EVENT#${item.eventId}`,
            sk: `ARTIST#${item.artistId}`,
          },
          UpdateExpression:
            'SET eventTitle = :eventTitle, eventStartDateTime = :eventStartDateTime',
          ExpressionAttributeValues: {
            ':eventTitle': newTitle,
            ':eventStartDateTime': newStartDateTime,
          },
        })
      )
    )
  );
}

export async function cascadeTalaNameUpdate(talaId: string, newName: string): Promise<void> {
  const { CompositionTalaEntity } = await import('./composition_tala/entity');
  const { CompositionEntity } = await import('./composition/entity');

  const result = await CompositionTalaEntity.query
    .byTala({ talaId })
    .go({ limit: CASCADE_BATCH_SIZE });
  const items = (result.data as Array<{ compositionId: string }>) || [];
  const now = new Date().toISOString();

  await Promise.all(
    items.map(async item => {
      const composition = await CompositionEntity.get({ id: item.compositionId }).go();
      if (!composition.data) return;

      const talas = composition.data.talas as Array<{ id: string; name: string }> | undefined;
      if (!talas || talas.length === 0) return;

      const updatedTalas = talas.map(t => (t.id === talaId ? { ...t, name: newName } : t));

      await dynamoClient.send(
        new UpdateCommand({
          TableName: TABLE_NAME,
          Key: {
            pk: `COMPOSITION#${item.compositionId}`,
            sk: '#METADATA',
          },
          UpdateExpression: 'SET talas = :talas, updatedAt = :updatedAt',
          ExpressionAttributeValues: { ':talas': updatedTalas, ':updatedAt': now },
        })
      );
    })
  );
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
  const eventArtistResult = await EventArtistEntity.query
    .byArtist({ artistId: loserId })
    .go({ limit: CASCADE_BATCH_SIZE });
  const eventArtistItems =
    (eventArtistResult.data as Array<{
      eventId: string;
      artistId: string;
      eventTitle: string;
      eventStartDateTime: string;
      artistTitle?: string;
      role?: string;
    }>) || [];

  await Promise.all(
    eventArtistItems.map(async item => {
      // Check if canonical record already exists for this event
      const existing = await EventArtistEntity.get({
        eventId: item.eventId,
        artistId: canonicalId,
      }).go();
      // Delete loser record
      await dynamoClient.send(
        new DeleteCommand({
          TableName: TABLE_NAME,
          Key: { pk: `EVENT#${item.eventId}`, sk: `ARTIST#${loserId}` },
        })
      );
      // Create canonical record if not already present
      if (!existing.data) {
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

  // Update Composition.composerId and composer.name
  const compositionResult = await CompositionEntity.query
    .byComposer({ composerId: loserId })
    .go({ limit: CASCADE_BATCH_SIZE });
  const compositionItems = (compositionResult.data as Array<{ id: string }>) || [];

  await Promise.all(
    compositionItems.map(item =>
      dynamoClient.send(
        new UpdateCommand({
          TableName: TABLE_NAME,
          Key: { pk: `COMPOSITION#${item.id}`, sk: '#METADATA' },
          UpdateExpression:
            'SET composerId = :composerId, composer.id = :composerId, composer.#name = :name, updatedAt = :updatedAt',
          ExpressionAttributeNames: { '#name': 'name' },
          ExpressionAttributeValues: {
            ':composerId': canonicalId,
            ':name': canonicalName,
            ':updatedAt': now,
          },
        })
      )
    )
  );
}

export async function cascadeVenueMerge(
  loserId: string,
  canonicalId: string,
  canonicalName: string
): Promise<void> {
  const { EventEntity } = await import('./event/entity');

  const result = await EventEntity.query
    .byVenue({ venueId: loserId })
    .go({ limit: CASCADE_BATCH_SIZE });
  const items = (result.data as Array<{ id: string }>) || [];
  const now = new Date().toISOString();

  await Promise.all(
    items.map(item =>
      dynamoClient.send(
        new UpdateCommand({
          TableName: TABLE_NAME,
          Key: { pk: `EVENT#${item.id}`, sk: '#METADATA' },
          UpdateExpression:
            'SET venueId = :venueId, venueName = :venueName, updatedAt = :updatedAt',
          ExpressionAttributeValues: {
            ':venueId': canonicalId,
            ':venueName': canonicalName,
            ':updatedAt': now,
          },
        })
      )
    )
  );
}

export async function cascadeOrganiserMerge(
  loserId: string,
  canonicalId: string,
  canonicalName: string
): Promise<void> {
  const { EventEntity } = await import('./event/entity');

  const result = await EventEntity.query
    .byOrganiser({ organiserId: loserId })
    .go({ limit: CASCADE_BATCH_SIZE });
  const items = (result.data as Array<{ id: string }>) || [];
  const now = new Date().toISOString();

  await Promise.all(
    items.map(item =>
      dynamoClient.send(
        new UpdateCommand({
          TableName: TABLE_NAME,
          Key: { pk: `EVENT#${item.id}`, sk: '#METADATA' },
          UpdateExpression:
            'SET organiserId = :organiserId, organiserName = :organiserName, updatedAt = :updatedAt',
          ExpressionAttributeValues: {
            ':organiserId': canonicalId,
            ':organiserName': canonicalName,
            ':updatedAt': now,
          },
        })
      )
    )
  );
}

export async function cascadeRagaMerge(
  loserId: string,
  canonicalId: string,
  canonicalName: string
): Promise<void> {
  const { CompositionRagaEntity } = await import('./composition_raga/entity');
  const { CompositionEntity } = await import('./composition/entity');

  const result = await CompositionRagaEntity.query
    .byRaga({ ragaId: loserId })
    .go({ limit: CASCADE_BATCH_SIZE });
  const items = (result.data as Array<{ compositionId: string }>) || [];
  const now = new Date().toISOString();

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
      const existing = await CompositionRagaEntity.get({ compositionId, ragaId: canonicalId }).go();
      if (!existing.data) {
        await CompositionRagaEntity.create({ compositionId, ragaId: canonicalId }).go();
      }

      // Update denormalized ragas array in Composition
      const composition = await CompositionEntity.get({ id: compositionId }).go();
      if (!composition.data) return;

      const ragas = composition.data.ragas as Array<{ id: string; name: string }> | undefined;
      if (!ragas) return;

      // Remove loser, add canonical (deduplicating)
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
}

export async function cascadeTalaMerge(
  loserId: string,
  canonicalId: string,
  canonicalName: string
): Promise<void> {
  const { CompositionTalaEntity } = await import('./composition_tala/entity');
  const { CompositionEntity } = await import('./composition/entity');

  const result = await CompositionTalaEntity.query
    .byTala({ talaId: loserId })
    .go({ limit: CASCADE_BATCH_SIZE });
  const items = (result.data as Array<{ compositionId: string }>) || [];
  const now = new Date().toISOString();

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
      const existing = await CompositionTalaEntity.get({ compositionId, talaId: canonicalId }).go();
      if (!existing.data) {
        await CompositionTalaEntity.create({ compositionId, talaId: canonicalId }).go();
      }

      // Update denormalized talas array in Composition
      const composition = await CompositionEntity.get({ id: compositionId }).go();
      if (!composition.data) return;

      const talas = composition.data.talas as Array<{ id: string; name: string }> | undefined;
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
}

export async function cascadeEventMerge(loserId: string, canonicalId: string): Promise<void> {
  const { EventArtistEntity } = await import('./event-artist/entity');

  // Get canonical event's existing artists
  const canonicalResult = await EventArtistEntity.query
    .primary({ eventId: canonicalId })
    .go({ limit: CASCADE_BATCH_SIZE });
  const canonicalArtistIds = new Set(
    (canonicalResult.data as Array<{ artistId: string }>).map(a => a.artistId)
  );

  // Get loser event's artists
  const loserResult = await EventArtistEntity.query
    .primary({ eventId: loserId })
    .go({ limit: CASCADE_BATCH_SIZE });
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

  // Get canonical event data for denormalized fields
  const { EventEntity } = await import('./event/entity');
  const canonicalEvent = await EventEntity.get({ id: canonicalId }).go();
  const canonicalTitle = canonicalEvent.data?.title ?? '';
  const canonicalStartDateTime = canonicalEvent.data?.startDateTime ?? '';

  await Promise.all(
    loserItems.map(async item => {
      // Delete loser EventArtist record
      await dynamoClient.send(
        new DeleteCommand({
          TableName: TABLE_NAME,
          Key: { pk: `EVENT#${loserId}`, sk: `ARTIST#${item.artistId}` },
        })
      );
      // Create canonical EventArtist record if not already present
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
}
