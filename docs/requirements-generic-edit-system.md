# Requirements Document: Generic Edit System

## Original Requirements

Create a generic edit system that can support any entity type (starting with compositions, then artists, ragas, talas, and future entities). Any user should be able to edit entities, with edits visible on a moderator's dashboard showing the diff. Moderators can accept or reject edits with reasons. If accepted, relevant fields are updated on the main entity. If rejected, users are notified. No IDs should be allowed to change.

## Clarifications (from Q&A - Generic System)

### Scope

1. **Initial Entities**: Start with compositions, but the system must support artists, ragas, talas, and future entities without requiring new backend code
2. **Frontend**: Each entity has its own form component (reusing generic primitives like SearchSelect, MultiSelectSearch)
3. **Moderator Dashboard**: Unified dashboard showing edits for all entity types

### Data Model

1. **Proposed Values Storage**: Store `proposedValues` as a JSON map rather than individual columns. This allows new entities to work without schema migrations. Validated against the entity's Zod schema
2. **Entity Type Tracking**: Edit record stores `entityType` and `entityId` to identify what is being edited
3. **Versioning**: All entities have their own `version` field, incremented on each approved edit

### Update Dispatch

1. **Handler Resolution**: Store entity name in edit record, use switch statement to dispatch to the correct update function (no registry pattern needed yet)
2. **Examples**:
   - `entityType: 'composition'` → calls `updateComposition`
   - `entityType: 'artist'` → calls `updateArtist`
   - etc.

### Zod Schema Integration

1. **Editable Field Metadata**: Add `isEditable: true` metadata to Zod schema fields that can be edited
2. **Validation**: `proposedValues` validated against the entity's update schema
3. **Form Generation**: Each entity has its own form component (not dynamically generated)

### ChangeHistory Integration

1. **Write on Approval**: The edit system writes directly to ChangeHistory when an edit is approved
2. **Diff Format**: Same field-level diffs as ChangeHistory expects (`{ field, oldValue, newValue }`)

### Search Integration

1. **Reuse Existing Endpoints**: Use the current search endpoints (searchArtists, searchRagas, searchTalas) for composer/raga/tala selection in forms
2. **No New Search Services**: The generic edit system doesn't add new search capabilities

## Editable Fields (via Zod Metadata)

Each entity defines its editable fields using Zod's metadata feature:

```typescript
export const UpdateCompositionSchema = z.object({
  title: z.string().min(1).max(500).metadata({ isEditable: true }),
  composer: z.object({ id: z.string(), name: z.string() }).metadata({ isEditable: true }),
  language: z.string().metadata({ isEditable: true }),
  ragaIds: z.array(z.string()).metadata({ isEditable: true }),
  talaIds: z.array(z.string()).metadata({ isEditable: true }),
  sourceAttribution: z.string().optional().metadata({ isEditable: true }),
  // lyricsV1: not editable in this phase
});
```

## Edit Workflow

1. **Create Draft**: User submits proposed values → stored as `status: 'draft'`
2. **Submit**: Draft → `status: 'submitted'`
3. **Moderator Review**: View diff, approve or reject with reason
4. **On Approve**:
   - Apply changes to entity
   - Increment entity version
   - Write to ChangeHistory
   - Update edit status to `approved`
5. **On Reject**:
   - Notify user with rejection reason
   - Update edit status to `rejected`
6. **Withdraw**: User can withdraw in draft or submitted state

## Non-Requirements

- Dynamic form generation from Zod schemas
- Registry pattern for update handlers (use switch statement)
- Bulk approval/rejection
- Edit assignment to specific moderators
- Real-time conflict resolution
- Email notifications (in-app only)
- Editing relationships (only direct fields)

## Technical Constraints

- Must use existing ChangeHistory entity for diff tracking
- Must use existing Fuse.js search service
- Must use existing RBAC for moderator permissions
- Must follow existing domain patterns (ElectroDB, Zod validation)
- No new DynamoDB entities per entity type (single generic Edit entity)
