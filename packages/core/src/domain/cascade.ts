import { UpdateCommand } from '@aws-sdk/lib-dynamodb';
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
