import { describe, expect, it } from 'vitest';
import { FollowEntity } from './entity';

/** Keys read off `.params()`, as in `venue-qr/keys.test.ts`. */
describe('follow keys', () => {
  const follow = {
    userId: 'user1',
    targetType: 'organiser' as const,
    targetId: 'org1',
    targetName: 'Sabha',
    source: 'qr' as const,
    shareWithTarget: false,
    createdAt: '2026-11-12T10:00:00.000Z',
  };

  it('sits in the user partition and indexes followers by target', () => {
    const { Item, ConditionExpression } = FollowEntity.create(follow).params() as {
      Item: Record<string, unknown>;
      ConditionExpression: string;
    };

    expect(Item.pk).toBe('user#user1');
    expect(Item.sk).toBe('follow#organiser#org1');
    expect(Item.gsi1pk).toBe('followers#organiser#org1');
    expect(Item.gsi1sk).toBe('2026-11-12t10:00:00.000z#user1');
    // The put that guards the counter: a second follow must be refused.
    expect(ConditionExpression).toContain('attribute_not_exists');
  });

  it('builds the delete key from the same composites', () => {
    const { Key } = FollowEntity.delete({
      userId: 'user1',
      targetType: 'organiser',
      targetId: 'org1',
    }).params() as { Key: { pk: string; sk: string } };

    expect(Key).toEqual({ pk: 'user#user1', sk: 'follow#organiser#org1' });
  });

  it('has no optional attribute in any key', () => {
    const optional = ['qrCode', 'eventId', 'shareConsentAt', 'shareConsentVersion'];
    const { Item } = FollowEntity.create(follow).params() as { Item: Record<string, unknown> };
    for (const field of optional) expect(Item).not.toHaveProperty(field);
    expect(String(Item.gsi1pk)).not.toMatch(/#$/);
  });
});
