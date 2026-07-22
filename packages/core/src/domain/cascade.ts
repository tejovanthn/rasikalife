import {
  BatchGetCommand,
  DeleteCommand,
  TransactWriteCommand,
  UpdateCommand,
} from '@aws-sdk/lib-dynamodb';
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
  const { ArtistAwardEntity } = await import('./artist-award/entity');
  const { ArtistEntity } = await import('./artist/entity');
  const { ArtistMembershipEntity } = await import('./artist-membership/entity');
  const { ArtistPhotoEntity } = await import('./artist-photo/entity');
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
        isFeatured?: boolean;
        featureRank?: number;
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
            // Featured status is curated by a moderator, so carry it across
            // rather than silently resetting it. Note this branch only runs
            // when the canonical has no row for the event; when both sides
            // performed, the canonical's row wins and a featured flag on the
            // loser is dropped — same as role and artistTitle already behave.
            isFeatured: item.isFeatured,
            featureRank: item.featureRank,
          }).go();
        }
      })
    );
  } while (eaCursor);

  // Migrate ArtistAward records from loser to canonical
  let awardCursor: string | null = null;
  do {
    const artistAwardResult = (await ArtistAwardEntity.query
      .primary({ artistId: loserId })
      .go({ limit: CASCADE_BATCH_SIZE, cursor: awardCursor })) as Page;
    const artistAwardItems =
      (artistAwardResult.data as Array<{
        awardId: string;
        awardName: string;
        rank?: number;
        year?: number;
        category?: string;
        notes?: string;
      }>) || [];
    awardCursor = artistAwardResult.cursor;

    // Batch-check which canonical records already exist (one BatchGet vs N individual GETs)
    const existingAwardResult = artistAwardItems.length
      ? await ArtistAwardEntity.get(
          artistAwardItems.map(item => ({ artistId: canonicalId, awardId: item.awardId }))
        ).go()
      : { data: [] as Array<{ awardId: string }> };
    const existingAwardSet = new Set((existingAwardResult.data ?? []).map(r => r.awardId));

    await Promise.all(
      artistAwardItems.map(async item => {
        await dynamoClient.send(
          new DeleteCommand({
            TableName: TABLE_NAME,
            Key: { pk: `ARTIST#${loserId}`, sk: `AWARD#${item.awardId}` },
          })
        );
        if (!existingAwardSet.has(item.awardId)) {
          await ArtistAwardEntity.upsert({
            artistId: canonicalId,
            artistName: canonicalName,
            awardId: item.awardId,
            awardName: item.awardName,
            rank: item.rank,
            year: item.year,
            category: item.category,
            notes: item.notes,
          }).go();
        }
      })
    );
  } while (awardCursor);

  // Migrate ArtistPhoto records from loser to canonical. The primary key partitions on
  // artistId, so this is a delete-then-write like the junction migrations above. No
  // existence check is needed: the photo id is unchanged and unique to the photo, so the
  // canonical partition can never already hold a row at PHOTO#${item.id}. Writing through
  // the entity (rather than a raw PutCommand) recomputes orderStr — and so the byArtist
  // GSI sort key — from order via its `watch` setter.
  let photoCursor: string | null = null;
  do {
    const photoResult = (await ArtistPhotoEntity.query
      .primary({ artistId: loserId })
      .go({ limit: CASCADE_BATCH_SIZE, cursor: photoCursor })) as Page;
    const photoItems =
      (photoResult.data as Array<{
        id: string;
        imageUrl: string;
        uploadId: string;
        caption?: string;
        credit?: string;
        order: number;
        featured: boolean;
        createdBy: string;
        createdAt: string;
      }>) || [];
    photoCursor = photoResult.cursor;

    await Promise.all(
      photoItems.map(async item => {
        await dynamoClient.send(
          new DeleteCommand({
            TableName: TABLE_NAME,
            Key: { pk: `ARTIST#${loserId}`, sk: `PHOTO#${item.id}` },
          })
        );
        await ArtistPhotoEntity.create({
          id: item.id,
          artistId: canonicalId,
          imageUrl: item.imageUrl,
          uploadId: item.uploadId,
          caption: item.caption,
          credit: item.credit,
          order: item.order,
          featured: item.featured,
          createdBy: item.createdBy,
          createdAt: item.createdAt,
        }).go();
      })
    );
  } while (photoCursor);

  // Migrate ArtistMembership records where the loser is the group
  let amGroupCursor: string | null = null;
  do {
    const groupResult = (await ArtistMembershipEntity.query
      .primary({ groupId: loserId })
      .go({ limit: CASCADE_BATCH_SIZE, cursor: amGroupCursor })) as Page;
    const groupItems =
      (groupResult.data as Array<{
        groupId: string;
        memberId: string;
        memberName: string;
        role?: string;
        rank?: number;
      }>) || [];
    amGroupCursor = groupResult.cursor;

    // Rewriting groupId to canonicalId would make the canonical its own member when
    // it is itself the member on this row — drop that row instead of writing it.
    const rewritableGroupItems = groupItems.filter(item => item.memberId !== canonicalId);

    const existingGroupResult = rewritableGroupItems.length
      ? await ArtistMembershipEntity.get(
          rewritableGroupItems.map(item => ({ groupId: canonicalId, memberId: item.memberId }))
        ).go()
      : { data: [] as Array<{ memberId: string }> };
    const existingGroupSet = new Set((existingGroupResult.data ?? []).map(r => r.memberId));

    await Promise.all(
      groupItems.map(async item => {
        await dynamoClient.send(
          new DeleteCommand({
            TableName: TABLE_NAME,
            Key: { pk: `GROUP#${loserId}`, sk: `MEMBER#${item.memberId}` },
          })
        );
        if (item.memberId !== canonicalId && !existingGroupSet.has(item.memberId)) {
          await ArtistMembershipEntity.upsert({
            groupId: canonicalId,
            groupName: canonicalName,
            memberId: item.memberId,
            memberName: item.memberName,
            role: item.role,
            rank: item.rank,
          }).go();
        }
      })
    );
  } while (amGroupCursor);

  // Migrate ArtistMembership records where the loser is the member
  let amMemberCursor: string | null = null;
  do {
    const memberResult = (await ArtistMembershipEntity.query
      .byMember({ memberId: loserId })
      .go({ limit: CASCADE_BATCH_SIZE, cursor: amMemberCursor })) as Page;
    const memberItems =
      (memberResult.data as Array<{
        groupId: string;
        groupName: string;
        memberId: string;
        role?: string;
        rank?: number;
      }>) || [];
    amMemberCursor = memberResult.cursor;

    // Rewriting memberId to canonicalId would make the canonical its own member when
    // it is itself the group on this row — drop that row instead of writing it.
    const rewritableMemberItems = memberItems.filter(item => item.groupId !== canonicalId);

    const existingMemberResult = rewritableMemberItems.length
      ? await ArtistMembershipEntity.get(
          rewritableMemberItems.map(item => ({ groupId: item.groupId, memberId: canonicalId }))
        ).go()
      : { data: [] as Array<{ groupId: string }> };
    const existingMemberSet = new Set((existingMemberResult.data ?? []).map(r => r.groupId));

    await Promise.all(
      memberItems.map(async item => {
        await dynamoClient.send(
          new DeleteCommand({
            TableName: TABLE_NAME,
            Key: { pk: `GROUP#${item.groupId}`, sk: `MEMBER#${loserId}` },
          })
        );
        if (item.groupId !== canonicalId && !existingMemberSet.has(item.groupId)) {
          await ArtistMembershipEntity.upsert({
            groupId: item.groupId,
            groupName: item.groupName,
            memberId: canonicalId,
            memberName: canonicalName,
            role: item.role,
            rank: item.rank,
          }).go();
        }
      })
    );
  } while (amMemberCursor);

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

  // Rewrite gurus[] entries that point at the loser on other artists. There is no GSI on
  // gurus[], so every artist has to be examined — but sweep the `list` index rather than
  // scanning, which on a single-table design would read every event, composition and edit
  // row too. Merges are rare and moderator-triggered, so sweeping the artist list is fine.
  let scanCursor: string | null = null;
  do {
    const scanResult = (await ArtistEntity.query.list({}).go({
      cursor: scanCursor,
      limit: CASCADE_BATCH_SIZE,
    })) as Page;
    const artists =
      (scanResult.data as Array<{ id: string; gurus?: Array<{ id?: string; name: string }> }>) ||
      [];
    scanCursor = scanResult.cursor;

    const artistsWithLoserGuru = artists.filter(artist =>
      (artist.gurus ?? []).some(guru => guru.id === loserId)
    );

    await Promise.all(
      artistsWithLoserGuru.map(artist => {
        const updatedGurus = (artist.gurus ?? []).map(guru =>
          guru.id === loserId ? { id: canonicalId, name: canonicalName } : guru
        );
        return dynamoClient.send(
          new UpdateCommand({
            TableName: TABLE_NAME,
            Key: { pk: `ARTIST#${artist.id}`, sk: '#METADATA' },
            UpdateExpression: 'SET gurus = :gurus, updatedAt = :updatedAt',
            ExpressionAttributeValues: { ':gurus': updatedGurus, ':updatedAt': now },
          })
        );
      })
    );
  } while (scanCursor);
}

export async function cascadeArtistNameUpdate(artistId: string, newName: string): Promise<void> {
  const { EventArtistEntity } = await import('./event-artist/entity');
  const { ArtistAwardEntity } = await import('./artist-award/entity');

  // One rename, one cascade. Composition composer names are a copy of the same
  // artist name, so they belong here rather than at the call site.
  await cascadeComposerNameUpdate(artistId, newName);

  // NOTE: gurus[].name on other artists is deliberately NOT refreshed here.
  // There is no index on gurus[], so reaching it means sweeping every artist
  // (see cascadeArtistMerge), which is defensible for a rare moderator-run
  // merge but not for an ordinary rename. Guru display names can go stale.

  let eaCursor: string | null = null;
  do {
    const result = (await EventArtistEntity.query
      .byArtist({ artistId })
      .go({ limit: CASCADE_BATCH_SIZE, cursor: eaCursor })) as Page;
    const items = (result.data as Array<{ eventId: string }>) || [];
    eaCursor = result.cursor;

    await Promise.all(
      items.map(item =>
        dynamoClient.send(
          new UpdateCommand({
            TableName: TABLE_NAME,
            Key: { pk: `EVENT#${item.eventId}`, sk: `ARTIST#${artistId}` },
            UpdateExpression: 'SET artistName = :artistName',
            ExpressionAttributeValues: { ':artistName': newName },
          })
        )
      )
    );
  } while (eaCursor);

  let awardCursor: string | null = null;
  do {
    const result = (await ArtistAwardEntity.query
      .primary({ artistId })
      .go({ limit: CASCADE_BATCH_SIZE, cursor: awardCursor })) as Page;
    const items = (result.data as Array<{ awardId: string }>) || [];
    awardCursor = result.cursor;

    await Promise.all(
      items.map(item =>
        dynamoClient.send(
          new UpdateCommand({
            TableName: TABLE_NAME,
            Key: { pk: `ARTIST#${artistId}`, sk: `AWARD#${item.awardId}` },
            UpdateExpression: 'SET artistName = :artistName',
            ExpressionAttributeValues: { ':artistName': newName },
          })
        )
      )
    );
  } while (awardCursor);
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
        isFeatured?: boolean;
        featureRank?: number;
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
            // Featured status is curated by a moderator, so carry it across
            // rather than silently resetting it. Note this branch only runs
            // when the canonical has no row for the event; when both sides
            // performed, the canonical's row wins and a featured flag on the
            // loser is dropped — same as role and artistTitle already behave.
            isFeatured: item.isFeatured,
            featureRank: item.featureRank,
          }).go();
          canonicalArtistIds.add(item.artistId);
        }
      })
    );
  } while (loserCursor);
}

// ─── Setlist cascades ─────────────────────────────────────────────────────────

export async function cascadeEventDeleteToSetlist(eventId: string): Promise<void> {
  const { ConcertLogItemEntity } = await import('./concert-log-item/entity');
  const { deleteAllEventSetlistRows } = await import('./event-setlist');

  let cursor: string | null = null;
  do {
    const result = (await ConcertLogItemEntity.query
      .byEvent({ eventId })
      .go({ limit: CASCADE_BATCH_SIZE, cursor })) as Page;
    const items = (result.data as Array<{ userId: string; orderStr: string }>) || [];
    cursor = result.cursor;

    await Promise.all(
      items.map(item =>
        ConcertLogItemEntity.delete({ userId: item.userId, eventId, orderStr: item.orderStr }).go()
      )
    );
  } while (cursor);

  await deleteAllEventSetlistRows(eventId);
}

export async function cascadeEventHardDeleteToSetlist(eventId: string): Promise<void> {
  const { ConcertLogItemEntity } = await import('./concert-log-item/entity');
  const { getEventSetlist, deleteAllEventSetlistRows } = await import('./event-setlist');
  const { adjustPerformanceCount: adjustCompositionCount } = await import('./composition');
  const { adjustPerformanceCount: adjustRagaCount } = await import('./raga');

  // Update counters before deleting
  const setlistRows = await getEventSetlist(eventId);
  const compositionIds = [
    ...new Set(setlistRows.map(r => r.compositionId).filter(Boolean) as string[]),
  ];
  const ragaIds = [...new Set(setlistRows.map(r => r.ragaId).filter(Boolean) as string[])];

  await Promise.all([
    ...compositionIds.map(id => adjustCompositionCount(id, -1)),
    ...ragaIds.map(id => adjustRagaCount(id, -1)),
  ]);

  // Hard-delete all ConcertLogItems
  let cursor: string | null = null;
  do {
    const result = (await ConcertLogItemEntity.query
      .byEvent({ eventId })
      .go({ limit: CASCADE_BATCH_SIZE, cursor })) as Page;
    const items = (result.data as Array<{ userId: string; orderStr: string }>) || [];
    cursor = result.cursor;

    await Promise.all(
      items.map(item =>
        dynamoClient.send(
          new DeleteCommand({
            TableName: TABLE_NAME,
            Key: {
              pk: `CONCERT_LOG_ITEMS#${item.userId}#${eventId}`,
              sk: `ITEM#${item.orderStr}`,
            },
          })
        )
      )
    );
  } while (cursor);

  await deleteAllEventSetlistRows(eventId);
}

export async function cascadeCompositionDeleteToSetlistItems(compositionId: string): Promise<void> {
  type Item = import('./concert-log-item/entity').ConcertLogItem;
  const { ConcertLogItemEntity } = await import('./concert-log-item/entity');
  const { recomputeEventSetlist } = await import('./event-setlist');
  const affectedEventIds = new Set<string>();

  let cursor: string | null = null;
  do {
    const result = (await ConcertLogItemEntity.query
      .byComposition({ compositionPerfKey: `COMPOSITION_PERFORMANCES#${compositionId}` })
      .go({ limit: CASCADE_BATCH_SIZE, cursor })) as Page;
    const items = (result.data as Item[]) || [];
    cursor = result.cursor;

    await Promise.all(
      items.map(item => {
        affectedEventIds.add(item.eventId);
        // Delete the linked item and re-create without compositionId or moderator fields.
        // ElectroDB watch setters fire on put: compositionPerfKey → undefined (clears gsi2),
        // pendingModerationKey → '1' (enters the pending moderation queue).
        const { Key: deleteKey, TableName } = ConcertLogItemEntity.delete({
          userId: item.userId,
          eventId: item.eventId,
          orderStr: item.orderStr,
        }).params();
        const { Item: putItem } = ConcertLogItemEntity.put({
          userId: item.userId,
          eventId: item.eventId,
          order: item.order,
          compositionTitle: item.compositionTitle,
          ragaId: item.ragaId,
          ragaName: item.ragaName,
          talaId: item.talaId,
          talaName: item.talaName,
          compositionType: item.compositionType,
          publicNote: item.publicNote,
          isHighlight: item.isHighlight ?? false,
          eventStartDateTime: item.eventStartDateTime,
        }).params();
        return dynamoClient.send(
          new TransactWriteCommand({
            TransactItems: [
              { Delete: { TableName, Key: deleteKey } },
              { Put: { TableName, Item: putItem } },
            ],
          })
        );
      })
    );
  } while (cursor);

  await Promise.all([...affectedEventIds].map(eventId => recomputeEventSetlist(eventId)));
}

export async function cascadeCompositionMergeToSetlistItems(
  fromId: string,
  toId: string
): Promise<void> {
  const { ConcertLogItemEntity } = await import('./concert-log-item/entity');
  const { recomputeEventSetlist } = await import('./event-setlist');
  const affectedEventIds = new Set<string>();

  let cursor: string | null = null;
  do {
    const result = (await ConcertLogItemEntity.query
      .byComposition({ compositionPerfKey: `COMPOSITION_PERFORMANCES#${fromId}` })
      .go({ limit: CASCADE_BATCH_SIZE, cursor })) as Page;
    const items =
      (result.data as Array<{ userId: string; eventId: string; orderStr: string }>) || [];
    cursor = result.cursor;

    await Promise.all(
      items.map(item => {
        affectedEventIds.add(item.eventId);
        // patch fires compositionPerfKey watcher → gsi2pk updates to COMPOSITION_PERFORMANCES#toId
        return ConcertLogItemEntity.patch({
          userId: item.userId,
          eventId: item.eventId,
          orderStr: item.orderStr,
        })
          .set({ compositionId: toId })
          .go();
      })
    );
  } while (cursor);

  await Promise.all([...affectedEventIds].map(eventId => recomputeEventSetlist(eventId)));
}

export async function cascadeRagaMergeToSetlistItems(
  fromId: string,
  toId: string,
  toName: string
): Promise<void> {
  const { ConcertLogItemEntity } = await import('./concert-log-item/entity');
  const { getEventSetlist, recomputeEventSetlist } = await import('./event-setlist');
  const { EventSetlistEntity } = await import('./event-setlist/entity');
  const affectedEventIds = new Set<string>();

  // Update ConcertLogItems — patch fires ragaPerfKey watcher → gsi3pk updates to RAGA_PERFORMANCES#toId
  let cursor: string | null = null;
  do {
    const result = (await ConcertLogItemEntity.query
      .byRaga({ ragaPerfKey: `RAGA_PERFORMANCES#${fromId}` })
      .go({ limit: CASCADE_BATCH_SIZE, cursor })) as Page;
    const items =
      (result.data as Array<{ userId: string; eventId: string; orderStr: string }>) || [];
    cursor = result.cursor;

    await Promise.all(
      items.map(item => {
        affectedEventIds.add(item.eventId);
        return ConcertLogItemEntity.patch({
          userId: item.userId,
          eventId: item.eventId,
          orderStr: item.orderStr,
        })
          .set({ ragaId: toId, ragaName: toName })
          .go();
      })
    );
  } while (cursor);

  // Update EventSetlist rows in all affected events, all statuses (including verified).
  // We load per-event rather than scanning byStatus globally — only affects events we know reference fromId.
  await Promise.all(
    [...affectedEventIds].map(async eventId => {
      const rows = await getEventSetlist(eventId);
      await Promise.all(
        rows
          .filter(r => r.ragaId === fromId)
          .map(row =>
            EventSetlistEntity.patch({ eventId, orderStr: row.orderStr })
              .set({ ragaId: toId, ragaName: toName })
              .go()
          )
      );
    })
  );

  await Promise.all([...affectedEventIds].map(eventId => recomputeEventSetlist(eventId)));
}

export async function cascadeUserDeleteToSetlistItems(userId: string): Promise<void> {
  const { ConcertLogEntity } = await import('./concert-log/entity');
  const { deleteAllUserSetlistItems } = await import('./concert-log-item');
  const { recomputeEventSetlist } = await import('./event-setlist');

  // Query all ConcertLogs for this user via the byUserDate GSI (correct DynamoDB query pattern)
  // This gives us all eventIds the user has logged, which is exactly what we need
  const affectedEventIds: string[] = [];
  let cursor: string | null = null;
  do {
    const result = (await ConcertLogEntity.query
      .byUserDate({ userId })
      .go({ limit: CASCADE_BATCH_SIZE, cursor })) as Page;
    const logs = (result.data as Array<{ eventId: string }>) || [];
    cursor = result.cursor;
    affectedEventIds.push(...logs.map(l => l.eventId));
  } while (cursor);

  // For each event, delete all this user's setlist items then recompute
  await Promise.all(
    affectedEventIds.map(async eventId => {
      await deleteAllUserSetlistItems(userId, eventId);
      await recomputeEventSetlist(eventId);
    })
  );
}

export async function cascadeEventMergeToSetlist(
  fromEventId: string,
  toEventId: string
): Promise<void> {
  const { ConcertLogItemEntity } = await import('./concert-log-item/entity');
  type Item = import('./concert-log-item/entity').ConcertLogItem;
  const { deleteAllEventSetlistRows, recomputeEventSetlist } = await import('./event-setlist');

  let cursor: string | null = null;
  do {
    const result = (await ConcertLogItemEntity.query
      .byEvent({ eventId: fromEventId })
      .go({ limit: CASCADE_BATCH_SIZE, cursor })) as Page;
    const items = (result.data as Item[]) || [];
    cursor = result.cursor;

    await Promise.all(
      items.map(item => {
        // Delete from loser event
        const { Key: deleteKey, TableName } = ConcertLogItemEntity.delete({
          userId: item.userId,
          eventId: fromEventId,
          orderStr: item.orderStr,
        }).params();

        // Put full item under canonical event — let ElectroDB recompute all GSI keys
        const { Item: putItem } = ConcertLogItemEntity.put({
          ...item,
          eventId: toEventId,
        }).params();

        return dynamoClient.send(
          new TransactWriteCommand({
            TransactItems: [
              { Delete: { TableName, Key: deleteKey } },
              { Put: { TableName, Item: putItem } },
            ],
          })
        );
      })
    );
  } while (cursor);

  await Promise.all([deleteAllEventSetlistRows(fromEventId), recomputeEventSetlist(toEventId)]);
}
