# tRPC Integration Tests Documentation

This document describes the integration test setup and key implementation patterns for the tRPC API layer.

## Overview

The tRPC package contains integration tests that run against real DynamoDB infrastructure through SST (Serverless Stack), not mocked services. This provides high confidence that the API works correctly in production-like conditions.

## Test Setup Architecture

### Test Contexts

**Regular User Context (`testRouter`)**
- Simulates authenticated user requests
- Used for standard API testing scenarios
- `isBot: false` for normal user behavior

**Bot Context (`botTestRouter`)**
- Simulates search engine/crawler requests
- Used to test bot-specific behavior (e.g., view tracking exemptions)
- `isBot: true` for testing analytics exclusions

### Test Data Isolation

Since integration tests use real DynamoDB, automatic cleanup is essential:

1. **Test User ID**: All test data is created with `editedBy: ['test-user-id']`
2. **Automatic Cleanup**: `afterEach` hook scans and deletes all test data
3. **Graceful Failures**: Cleanup failures are logged as warnings, not test failures

```typescript
// Cleanup implementation
afterEach(async () => {
  const testItems = await scan({
    FilterExpression: 'contains(#editedBy, :testUserId)',
    // ... scan for test data
  });
  await Promise.all(testItems.items.map(item => deleteItem(item.key)));
});
```

## Artist Domain Implementation

### 1. Popularity Ranking (GSI5)

**Problem**: Need to efficiently query artists by popularity score in descending order.

**Solution**: Custom GSI with padded numeric sort key for proper DynamoDB sorting.

```typescript
// GSI Structure
GSI5PK: 'POPULARITY'  // All artists share same partition
GSI5SK: 'SCORE#0000000123#artist_id'  // Padded score enables sorting
```

**Key Features**:
- Zero-padded scores ensure correct string-based numeric sorting
- Single partition for all artists enables efficient popularity queries
- Artist ID suffix ensures uniqueness when scores are identical

### 2. Text Search with Pagination

**Problem**: DynamoDB doesn't support full-text search, but we need searchable artist names.

**Solution**: Scan-based approach with filters and pagination support.

```typescript
// Search implementation
const result = await scan({
  FilterExpression: 'begins_with(PK, :pkPrefix) AND SK = :skValue AND contains(#name, :searchTerm)',
  Limit: limit * 3,  // Over-scan to improve hit rate
  ExclusiveStartKey: nextToken  // Pagination support
});
```

**Optimizations**:
- **Over-scanning**: Request 3x more items than needed to improve hit rate
- **Case Sensitivity**: Uses exact case matching for reliability
- **Result Scoring**: Applies relevance scoring to rank search results
- **Pagination**: Full nextToken support for large result sets

### 3. Atomic View Tracking

**Problem**: Concurrent view count updates can cause race conditions with read-modify-write operations.

**Solution**: DynamoDB's native ADD operation for atomic increments.

```typescript
// Atomic increment implementation
await docClient.send(new UpdateCommand({
  UpdateExpression: 'ADD viewCount :increment',
  ExpressionAttributeValues: { ':increment': 1 }
}));
```

**Benefits**:
- **Atomic**: No race conditions under concurrent access
- **Efficient**: Single operation instead of read-modify-write
- **Bot-Aware**: Conditional execution based on request context

## Test Coverage

### Passing Tests (13/14)

✅ **CRUD Operations**
- Create artist with validation
- Read by ID with view tracking
- Update artist data
- Data persistence verification

✅ **Analytics & Views**
- View count increment for regular users
- View tracking exemption for bots
- Popular artists ranking by score

✅ **Search & Discovery**
- Text search with relevance scoring
- Search result pagination
- Result limit enforcement

✅ **Data Integrity**
- Input validation and error handling
- Test data isolation between tests
- Proper error responses for invalid data

### Skipped Tests (1/14)

⏭️ **Advanced Search Filtering**
- Tradition-based filtering with text search
- Complex multi-criteria search scenarios

*Note: Skipped due to DynamoDB's text search limitations. Future implementations may use dedicated search services (e.g., OpenSearch).*

## Performance Characteristics

### Query Performance
- **Popularity**: O(1) GSI query, highly efficient
- **Text Search**: O(n) scan operation, acceptable for moderate datasets
- **View Increment**: O(1) atomic operation

### Test Execution
- **Duration**: ~17 seconds for full suite
- **Parallelization**: Safe due to test data isolation
- **Resource Usage**: Real DynamoDB read/write capacity

## Best Practices

### Writing Integration Tests

1. **Use Consistent Test User**: Always use `test-user-id` for data attribution
2. **Handle Eventual Consistency**: Add small delays after write operations
3. **Test Real Scenarios**: Don't mock external dependencies
4. **Clean Test Data**: Rely on automatic cleanup, don't manually manage

### DynamoDB Design Patterns

1. **GSI Design**: Use composite sort keys for complex sorting requirements
2. **Search Strategy**: Prefer scan with filters over complex GSI structures for text search
3. **Atomic Operations**: Use ADD/SET operations instead of read-modify-write patterns
4. **Pagination**: Always support nextToken for scalable result sets

## Future Improvements

### Search Enhancement
- **OpenSearch Integration**: Replace scan-based search with dedicated search service
- **Fuzzy Matching**: Implement approximate string matching for better UX
- **Search Analytics**: Track search terms and result quality

### Performance Optimization
- **Caching Layer**: Add Redis/ElastiCache for frequently accessed data
- **Connection Pooling**: Optimize DynamoDB connection management
- **Batch Operations**: Implement batch reads/writes for bulk operations

### Test Infrastructure
- **Parallel Execution**: Optimize test isolation for faster CI/CD
- **Mock Fallback**: Hybrid approach with mocks for unit tests, real services for integration
- **Performance Testing**: Add load testing for critical paths