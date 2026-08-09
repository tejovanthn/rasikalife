/**
 * Undo a soft-deleted event.
 *
 * The moderator delete button sets `deletedAt` and there is no button that unsets it, so an
 * event deleted by mistake — usually to get around some *other* problem with the record —
 * could only be brought back by editing the table by hand, which means rewriting five GSI
 * sort keys (CLAUDE.md rule 7). `Event.restoreEvent` does it through the entity instead.
 *
 * Usage: `pnpm cli restore-event <id> [--dry-run]`
 */
export async function restoreEvent(id: string, opts: { dryRun?: boolean } = {}): Promise<void> {
  const { dryRun = false } = opts;
  const { Event } = await import('@rasika/core');

  const existing = await Event.getEventIncludingDeleted(id);

  if (!existing) {
    console.error(`No event with id ${id}. It may have been hard deleted, or never existed.`);
    process.exit(1);
  }
  if (existing.mergedIntoId) {
    console.error(
      `Event ${id} was merged into ${existing.mergedIntoId}, not deleted. Restoring it would re-split the merge; undo the merge instead.`
    );
    process.exit(1);
  }
  if (!existing.deletedAt) {
    console.log(`Event ${id} ("${existing.title}") is not deleted. Nothing to do.`);
    return;
  }

  console.log(`Event ${id} — "${existing.title}"`);
  console.log(`  deleted at:  ${existing.deletedAt}`);
  console.log(`  starts:      ${existing.startDateTime}`);
  console.log(`  status:      ${existing.status}`);

  if (dryRun) {
    console.log('\n[dry-run] Would clear deletedAt and rebuild the cast’s collaborators.');
    return;
  }

  await Event.restoreEvent(id);
  console.log('\nRestored.');

  const { reindex } = await import('./reindex.js');
  await reindex();
}
