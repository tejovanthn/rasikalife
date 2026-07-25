/**
 * Key building for the raw-command paths.
 *
 * ElectroDB lowercases key values, so the table holds `event#abc` / `#metadata`. A
 * hand-built `EVENT#abc` matches nothing, and the two failure modes are both silent:
 * DeleteItem reports success having deleted nothing, and UpdateItem *creates* the row
 * rather than updating the real one. That produced phantom rows in production.
 *
 * Most writes go through ElectroDB and never need this. These helpers exist for the
 * places that must drop to a raw command — atomic counters (`ADD rsvpCount :delta`) and
 * nested-attribute updates (`SET composer.#name`) — which ElectroDB cannot express.
 *
 * `conversions.fromComposite.toKeys` is used rather than `get(...).params()` because
 * several entities also use `get` for batch reads, and tests mock it.
 */
type KeyedEntity = { conversions: { fromComposite: { toKeys: (composite: never) => unknown } } };

type CompositeOf<T extends KeyedEntity> = Parameters<
  T['conversions']['fromComposite']['toKeys']
>[0];

/**
 * Every key ElectroDB would write for this row, GSI keys included.
 *
 * A key whose composite you did not fully supply comes back `undefined` — pass only
 * `{id}` for an entity with a `byComposer` GSI and `gsi2pk` is `undefined`. Never feed
 * such a value into a raw `SET gsiXpk = :v`: DynamoDB reads an undefined attribute value
 * as a *remove*, which drops the row out of that index. Read a GSI key only after
 * supplying every composite it is built from.
 */
export function keysOfEntity<T extends KeyedEntity>(
  entity: T,
  composite: CompositeOf<T>
): Record<string, unknown> {
  return entity.conversions.fromComposite.toKeys(composite) as Record<string, unknown>;
}

/** The primary key for this row. */
export function keyOfEntity<T extends KeyedEntity>(
  entity: T,
  composite: CompositeOf<T>
): { pk: string; sk: string } {
  const keys = keysOfEntity(entity, composite);
  return { pk: keys.pk as string, sk: keys.sk as string };
}
