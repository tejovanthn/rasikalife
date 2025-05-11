# Core Library Function Signatures and Descriptions

This document outlines the function signatures and provides a brief two-line description for each function found in the core library codebase.

## Database Operations (`src/db/operations.ts`)

* **`putItem(item: DynamoItem, tableName?: string): Promise<DynamoItem>`**
    Put an item in DynamoDB.
    Returns the result of the operation.
* **`batchPutItems(items: DynamoItem[], tableName?: string): Promise<void>`**
    Put multiple items in DynamoDB in a single transaction.
    Returns Result of the operation.
* **`transactWriteItems(items: DynamoItem[], tableName?: string): Promise<void>`**
    Transaction to write multiple items atomically.
    Returns Result of the operation.
* **`getItem<T extends DynamoItem>(key: DynamoKey, tableName?: string): Promise<T | null>`**
    Get a single item by key.
    Returns The item or null if not found.
* **`batchGetItems<T extends DynamoItem>(keys: DynamoKey[], tableName?: string): Promise<T[]>`**
    Get multiple items by keys.
    Returns Array of items found.
* **`updateItem<T extends DynamoItem>(key: DynamoKey, updates: Record<string, any>, tableName?: string): Promise<T>`**
    Update an item in DynamoDB.
    Returns The updated item.
* **`deleteItem(key: DynamoKey, tableName?: string): Promise<boolean>`**
    Delete an item from DynamoDB.
    Returns True if the item was deleted, false if it didn't exist.
* **`query<T extends DynamoItem>(params: Omit<QueryCommandInput, 'TableName'> & { TableName?: string }): Promise<PaginationResult<T>>`**
    Execute a query against DynamoDB.
    Returns The query results with pagination token.
* **`scan<T extends DynamoItem>(params: Omit<ScanCommandInput, 'TableName'> & { TableName?: string }): Promise<PaginationResult<T>>`**
    Execute a scan against DynamoDB.
    Returns The scan results with pagination token.

## Database Query Builder (`src/db/queryBuilder.ts`)

* **`QueryBuilder<T extends DynamoItem = DynamoItem>.withPartitionKey(key: string, value: string): QueryBuilder<T>`**
    Add a partition key condition.
    Returns The query builder instance for chaining.
* **`QueryBuilder<T extends DynamoItem = DynamoItem>.withSortKey(key: string, value: string): QueryBuilder<T>`**
    Add a sort key equality condition.
    Returns The query builder instance for chaining.
* **`QueryBuilder<T extends DynamoItem = DynamoItem>.withSortKeyBeginsWith(key: string, prefix: string): QueryBuilder<T>`**
    Add a begins_with condition for a sort key.
    Returns The query builder instance for chaining.
* **`QueryBuilder<T extends DynamoItem = DynamoItem>.withSortKeyBetween(key: string, start: string, end: string): QueryBuilder<T>`**
    Add a between condition for a sort key.
    Returns The query builder instance for chaining.
* **`QueryBuilder<T extends DynamoItem = DynamoItem>.withFilter(attribute: string, operator: string, value: any): QueryBuilder<T>`**
    Add a filter expression.
    Returns The query builder instance for chaining.
* **`QueryBuilder<T extends DynamoItem = DynamoItem>.withIndex(indexName: string): QueryBuilder<T>`**
    Set the index to query.
    Returns The query builder instance for chaining.
* **`QueryBuilder<T extends DynamoItem = DynamoItem>.withLimit(limit: number): QueryBuilder<T>`**
    Set the maximum number of items to return.
    Returns The query builder instance for chaining.
* **`QueryBuilder<T extends DynamoItem = DynamoItem>.withSortOrder(ascending: boolean): QueryBuilder<T>`**
    Set the sort order (ascending or descending).
    Returns The query builder instance for chaining.
* **`QueryBuilder<T extends DynamoItem = DynamoItem>.withStartKey(exclusiveStartKey: Record<string, string>): QueryBuilder<T>`**
    Set the starting point for pagination.
    Returns The query builder instance for chaining.
* **`QueryBuilder<T extends DynamoItem = DynamoItem>.withProjection(attributes: string[]): QueryBuilder<T>`**
    Set projection expression to limit attributes returned.
    Returns The query builder instance for chaining.
* **`QueryBuilder<T extends DynamoItem = DynamoItem>.execute(): Promise<PaginationResult<T>>`**
    Execute the query and return the results.
    Returns Promise with the query results.
* **`QueryBuilder<T extends DynamoItem = DynamoItem>.executePaginated(params: PaginationParams): Promise<PaginationResult<T>>`**
    Execute a paginated query.
    Returns Promise with the query results.
* **`createQuery<T extends DynamoItem>(options?: QueryBuilderOptions): QueryBuilder<T>`**
    Create a new query builder.
    Returns A new query builder instance.

## Shared Access Patterns (`src/shared/accessPatterns.ts`)

* **`getByPrimaryKey<T extends DynamoItem>(entityType: EntityPrefix, id: string, sortKey: string = SecondaryPrefix.METADATA): Promise<T | null>`**
    Get an item by its primary key.
    Returns Promise with the item or null if not found.
* **`getAllByPartitionKey<T extends DynamoItem>(entityType: EntityPrefix, id: string, options: { limit?: number; exclusiveStartKey?: Record<string, any>; sortKeyPrefix?: string; sortKeyBetween?: { start: string; end: string }; scanIndexForward?: boolean; } = {}): Promise<{ items: T[]; lastEvaluatedKey?: Record<string, any> }>`**
    Get all items for an entity by partition key.
    Returns Promise with query results.
* **`getByGlobalIndex<T extends DynamoItem>(indexName: string, partitionKeyName: string, partitionKeyValue: string, options: { sortKeyName?: string; sortKeyValue?: string; sortKeyPrefix?: string; sortKeyBetween?: { start: string; end: string }; limit?: number; exclusiveStartKey?: Record<string, any>; scanIndexForward?: boolean; } = {}): Promise<{ items: T[]; lastEvaluatedKey?: Record<string, any> }>`**
    Get items by a global secondary index.
    Returns Promise with query results.
* **`getByStatusAndDateRange<T extends DynamoItem>(indexName: string, statusPrefix: string, statusValue: string, datePrefix: string, dateRange: { start: string; end: string }, options: { limit?: number; exclusiveStartKey?: Record<string, any>; scanIndexForward?: boolean; } = {}): Promise<{ items: T[]; lastEvaluatedKey?: Record<string, any> }>`**
    Get items by a GSI for a date range.
    Returns Promise with query results.
* **`createRelatedItems<T extends DynamoItem>(primaryItem: T, relatedItems: DynamoItem[]): Promise<T>`**
    Create or update related items in a transaction.
    Returns Promise with the primary item.
* **`itemExists(key: Record<string, any>): Promise<boolean>`**
    Check if an item exists by any key.
    Returns Promise with boolean result.
* **`getByDateRange<T extends DynamoItem>(entityType: EntityPrefix, id: string, sortKeyPrefix: string, dateRange: { start: string; end: string }, options: { limit?: number; exclusiveStartKey?: Record<string, any>; scanIndexForward?: boolean; } = {}): Promise<{ items: T[]; lastEvaluatedKey?: Record<string, any> }>`**
    Query items by a date range on the base table.
    Returns Promise with query results.

## Shared Pagination Utilities (`src/shared/pagination.ts`)

* **`normalizePaginationParams(params?: Partial<PaginationParams>): PaginationParams`**
    Validate and normalize pagination parameters.
    Returns Normalized pagination parameters.
* **`createNextToken(lastEvaluatedKey?: Record<string, any>): string | undefined`**
    Convert a DynamoDB LastEvaluatedKey to a base64 next token.
    Returns Base64 encoded next token or undefined.
* **`parseNextToken(nextToken?: string): Record<string, any> | undefined`**
    Parse a next token back to a DynamoDB LastEvaluatedKey.
    Returns DynamoDB LastEvaluatedKey object or undefined.
* **`createPaginatedResponse<T>(items: T[], lastEvaluatedKey?: Record<string, any>): { items: T[]; nextToken?: string; hasMore: boolean; }`**
    Create a standardized pagination result object.
    Returns Standardized pagination result.

## Shared Search Utilities (`src/shared/search.ts`)

* **`basicSearch<T extends DynamoItem>(searchTerm: string, options: SearchOptions): Promise<{ items: T[]; nextToken?: string; hasMore: boolean; }>`**
    Simple search implementation using DynamoDB Scan.
    Returns Paginated search results.
* **`createPrefixSearchTerm(term: string): string`**
    Create a prefixed search term for partial matching at the beginning of words.
    Returns Processed search term.
* **`scoreSearchResults<T>(items: T[], searchTerm: string, fields: Array<{ name: string; weight: number }>): T[]`**
    Score search results based on relevance.
    Returns Scored and sorted items.

## Shared Single Table Utilities (`src/shared/singleTable.ts`)

* **`formatKey(prefix: EntityPrefix | string, id: string): string`**
    Format a key with entity prefix and ID.
    Returns Formatted key (e.g., "USER#123").
* **`formatDateSortKey(prefix: SecondaryPrefix | string, date: string, id?: string): string`**
    Format a date-based sort key.
    Returns Formatted date key (e.g., "DATE#2023-01-01#ITEM#123").
* **`formatVersionKey(version: string, timestamp?: string): string`**
    Create a version sort key.
    Returns Formatted version key (e.g., "VERSION#v1#2023-01-01T00:00:00.000Z").
* **`createBaseItem(entityType: EntityPrefix, id?: string, sortKey: string = SecondaryPrefix.METADATA): Promise<DynamoItem>`**
    Create a base DynamoDB item for a new entity.
    Returns Promise with base item structure.
* **`createCompositeId(parts: string[]): string`**
    Create a composite ID for entities that need a compound key.
    Returns Composite ID string.
* **`formatIndexKey(prefix: string, value: string): string`**
    Format a secondary index key.
    Returns Formatted GSI key (e.g., "EMAIL#test@example.com").
* **`extractIdFromKey(key: string): string`**
    Extract ID from a formatted key.
    Returns The extracted ID.
* **`addUpdateTimestamp<T extends { updatedAt?: string }>(item: T): T`**
    Add timestamps to an item for updates.
    Returns The item with updated timestamp.

## Types (`src/types/common.ts`)

* **`ApplicationError extends Error`**
    Base application error.
    Constructor for ApplicationError.
* **`interface Repository<T extends BaseEntity, K = string>`**
    Generic type for repository operations.
* **`create(item: Omit<T, 'id' | 'createdAt' | 'updatedAt'>): Promise<T>`**
    Create a new item.
* **`getById(id: K): Promise<T | null>`**
    Get an item by its ID.
* **`update(id: K, item: Partial<T>): Promise<T>`**
    Update an existing item.
* **`delete(id: K): Promise<void>`**
    Delete an item by its ID.
* **`list(params?: PaginationParams): Promise<PaginatedResult<T>>`**
    List items with optional pagination.

## Utility Functions (`src/utils`)

* **`getCurrentISOString(): string`**
    Get the current ISO datetime string.
* **`formatDateYYYYMMDD(date: Date): string`**
    Format a date as YYYY-MM-DD.
* **`toISOString(date: Date | string | number): string`**
    Convert a date to ISO string, handling different input types.
* **`addDays(date: Date, days: number): Date`**
    Add days to a date.
* **`isPast(date: Date | string): boolean`**
    Check if a date is in the past.
* **`isFuture(date: Date | string): boolean`**
    Check if a date is in the future.
* **`daysBetween(dateA: Date | string, dateB: Date | string): number`**
    Calculate the difference between two dates in days.
* **`getTimeBasedShard(id: string, shardCount = 10): number`**
    Generate a time-based shard key for high-volume items.
* **`generateId(): Promise<string>`**
    Generate a new KSUID-based ID.
* **`generatePrefixedId(prefix: string): Promise<string>`**
    Generate a prefixed ID for domain entities.
* **`generateIdSync(): string`**
    Generate a new KSUID-based ID synchronously.
* **`generateRandomString(length = 6): string`**
    Generate a new random string (for verification codes, etc.).
* **`getTimestampFromId(id: string): Date`**
    Parse timestamp from KSUID.
* **`createStringSchema({ required = true, minLength, maxLength, trim = true, }: { required?: boolean; minLength?: number; maxLength?: number; trim?: boolean; }): z.ZodEffects<z.ZodString, string, string>`**
    Create a standard string schema with min/max length.
* **`emailSchema: z.ZodEffects<z.ZodString, string, string>`**
    Email validation schema.
* **`usernameSchema: z.ZodEffects<z.ZodString, string, string>`**
    Username validation schema.
* **`passwordSchema: z.ZodString`**
    Password validation schema.
* **`dateStringSchema: z.ZodEffects<z.ZodString, string, string>`**
    Date string validation schema.
* **`isoDateStringSchema: z.ZodEffects<z.ZodString, string, string>`**
    ISO date string validation schema (stricter).
* **`createArraySchema<T extends z.ZodTypeAny>(schema: T, { required = true, minItems, maxItems, unique = false, nonEmpty = false, }: { required?: boolean; minItems?: number; maxItems?: number; unique?: boolean; nonEmpty?: boolean; }): z.ZodOptional<z.ZodArray<T, "atleastone"> | z.ZodArray<T, "many"> | z.ZodArray<T, "notempty"> | z.ZodArray<T, "empty">>`**
    Array validation schema.
* **`socialLinksSchema: z.ZodOptional<z.ZodObject<...>>`**
    Social links validation schema.
* **`locationSchema: z.ZodObject<...>`**
    Location validation schema.