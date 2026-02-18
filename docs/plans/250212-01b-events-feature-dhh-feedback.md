# DHH Code Review: Events Feature V2 Spec

**Review Date:** February 12, 2026  
**Reviewer:** DHH Code Reviewer  
**Spec File:** `/docs/plans/250212-01b-events-feature.md`  
**Verdict:** **CONDITIONALLY APPROVED** ✅

---

## Overall Assessment

The V2 spec represents exactly the kind of reductive engineering DHH advocates. You've taken a bloated, enterprise-grade specification and transformed it into something that could actually ship. The complexity budget is now focused where it matters—AI extraction quality—rather than infrastructure theater.

**Major changes from V1 → V2:**
- 4 entities → 1 entity ✅
- 7 status states → 4 status states ✅
- 13 GSIs → 3 GSIs ✅
- Async Lambda pipeline → Synchronous processing ✅
- Fuzzy matching → Manual selection ✅
- Festival parsing → Deferred ✅
- Entity ownership → Removed ✅
- Moderation workflow → Direct approval ✅

**The spec is shippable with one critical fix.**

---

## Critical Issues

### 1. Missing `createdAt` Attribute

**Location:** DynamoDB Entity Definition (line ~258)

**Problem:**

The GSI1 (byCreator) index uses `createdAt` as the sort key:

```typescript
byCreator: {
  index: 'gsi1',
  pk: { field: 'gsi1pk', composite: ['createdBy'], template: `${EntityPrefix.USER}#${'$'}{createdBy}` },
  sk: { field: 'gsi1sk', composite: ['createdAt'] }, // ❌ 'createdAt' is not defined in attributes
},
```

But `createdAt` is never defined in the `attributes` section. The EventSchema also lacks `createdAt`:

```typescript
export const EventSchema = z.object({
  id: z.string(),
  // ... many fields ...
  createdBy: z.string(),
  updatedAt: z.string().datetime(),
  // ❌ missing createdAt
});
```

**Impact:** This will cause runtime errors when ElectroDB tries to write to DynamoDB.

**Fix:**

Add `createdAt` to the EventSchema:

```typescript
export const EventSchema = z.object({
  id: z.string(),
  // ... existing fields ...
  createdBy: z.string(),
  createdAt: z.string().datetime(), // Add this
  updatedAt: z.string().datetime(),
});
```

Add `createdAt` to the EventEntity attributes:

```typescript
attributes: {
  id: { type: 'string', required: true },
  // ... existing attributes ...
  createdBy: { type: 'string', required: true },
  createdAt: { type: 'string', required: true }, // Add this
  updatedAt: { type: 'string', required: true },
},
```

And populate it in `createFromPoster`:

```typescript
const event = await EventEntity.create({
  id,
  // ... existing fields ...
  createdAt: new Date().toISOString(), // Add this
  updatedAt: new Date().toISOString(),
}).go();
```

---

## What Works Well

### 1. Single Entity Design

Embedding Venue, Organiser, Artist, and Ticketing as objects/arrays on the Event entity is exactly right for v1. You're not over-normalizing and you're not prematurely creating separate entities that may never be needed.

### 2. Status Workflow

The 4-state workflow (draft → pending_verification → approved/rejected) is appropriate. You're not building a moderation system before you have moderators.

### 3. GSI Design

Three GSIs with clear purposes:
- **Primary**: CRUD by ID
- **byCreator**: User's events and drafts
- **upcoming**: Public event listings

Each GSI maps to a real access pattern. No GSIs for "future use."

### 4. Synchronous AI Extraction

Processing the poster synchronously during verification is simpler and more reliable than an async Lambda pipeline. Accept the 10-second latency—it doesn't matter for an MVP where you're validating the core concept.

### 5. Manual Artist/Venue Selection

No fuzzy matching. No duplicate detection algorithms. Just show extracted data and let users manually link entities. This is the right trade-off for v1.

### 6. Service Layer Design

The service methods are focused and composable. Each method does one thing. The code reads like prose.

### 7. Infrastructure (SST)

The SST stack is minimal and appropriate. One S3 bucket, one Lambda function for extraction, one secret. No over-engineered infrastructure.

---

## Minor Issues (Fix Before Implementation)

### 1. GSI1pk Template Inconsistency

The GSI1pk template uses `EntityPrefix.USER` (`'USER#...'`), which is correct. But the documentation table mentions "By creator (for user's drafts)" which could be clearer. Consider updating the table to match the actual implementation.

**Current (line 275):**
```typescript
| GSI1 (byCreator) | User's events | `getUserEvents(userId)`, `getUserDrafts(userId)` |
```

**Suggested:**
```typescript
| GSI1 (byCreator) | User's events and drafts | `getUserEvents(userId)`, `getUserDrafts(userId)` |
```

### 2. Missing `rejectionReason` from VerifyEventInputSchema

The EventSchema has `rejectionReason: z.string().optional()` (line 180), but `VerifyEventInputSchema` (lines 198-209) doesn't include it. Users can only be rejected, not self-reject. If this field is for moderator rejection (future), document it. If not needed in v1, remove it from the EventSchema.

---

## Changes Summary (V1 → V2)

| Aspect | V1 | V2 | Status |
|--------|----|----|----|
| Entities | 7 | 1 | ✅ Fixed |
| Status States | 7 | 4 | ✅ Fixed |
| GSIs | 13 | 3 | ✅ Fixed |
| Processing | Async Lambda | Synchronous | ✅ Fixed |
| Fuzzy Matching | Yes | Manual selection | ✅ Fixed |
| Festival Parsing | Yes | Deferred | ✅ Fixed |
| Entity Ownership | Yes | Removed | ✅ Fixed |
| Moderation Workflow | Yes | Direct approval | ✅ Fixed |
| PosterUpload Entity | Separate | Embedded | ✅ Fixed |
| EventArtist Entity | Separate | Embedded | ✅ Fixed |
| `createdAt` Attribute | - | Missing | ❌ Needs Fix |

---

## Final Verdict

**CONDITIONALLY APPROVED**

Add the missing `createdAt` attribute to both the Zod schema and the ElectroDB entity, and this spec is ready for implementation.

The V2 spec demonstrates the kind of reductive engineering that makes software shippable. You've kept the complexity budget focused on what matters (AI extraction quality) and eliminated the infrastructure theater (GSIs for unused access patterns, status machines for imagined workflows).

---

*"Perfection is achieved, not when there is nothing more to add, but when there is nothing left to take away."* — Antoine de Saint-Exupéry

This spec is 90% of the way there. Fix `createdAt` and ship it.
