# Coding Standards & Conventions

## File Naming & Organization

### File Naming
- Use camelCase for files: `userRepository.ts`, `artistService.ts`
- Use PascalCase for components: `ArtistCard.tsx`, `EventDetails.tsx`
- Test files: `userRepository.test.ts`, collocated with implementation
- Index files for clean exports: `index.ts` in each directory

### Directory Structure
```
domain/user/
├── index.ts              # Exports
├── types.ts              # Domain-specific types
├── repository.ts         # Data access
├── repository.test.ts    # Repository tests
├── service.ts            # Business logic
├── service.test.ts       # Service tests
└── validation.ts         # Zod schemas
```

## TypeScript Conventions

### Interface Naming
```typescript
// Entity interfaces
interface User extends BaseEntity { }
interface Artist extends BaseEntity { }

// Input/Output types
interface CreateUserInput { }
interface UpdateArtistInput { }
interface UserSearchResult { }

// Service interfaces
interface UserRepository { }
interface ArtistService { }
```

### Enum Usage
```typescript
// Always use string enums for serialization
enum UserRole {
  USER = 'user',
  ARTIST = 'artist',
  ADMIN = 'admin'
}

// Use in types
interface User {
  roles: UserRole[];
}
```

### Generic Patterns
```typescript
// Repository pattern
interface Repository<T extends BaseEntity, K = string> {
  create(item: Omit<T, 'id' | 'createdAt' | 'updatedAt'>): Promise<T>;
  getById(id: K): Promise<T | null>;
  update(id: K, item: Partial<T>): Promise<T>;
  delete(id: K): Promise<void>;
  list(params?: PaginationParams): Promise<PaginatedResult<T>>;
}

// Service pattern
interface Service<T extends BaseEntity> {
  create(input: CreateInput): Promise<T>;
  get(id: string): Promise<T | null>;
  update(id: string, input: UpdateInput): Promise<T>;
  search(params: SearchParams): Promise<SearchResult<T>>;
}
```

## Database Conventions

### Key Formatting
```typescript
// Always use helper functions
const userKey = formatKey(EntityPrefix.USER, userId);
const artistKey = formatKey(EntityPrefix.ARTIST, artistId);

// Sort keys with prefixes
const metadataKey = SecondaryPrefix.METADATA;
const dateKey = formatDateSortKey(SecondaryPrefix.DATE, '2023-01-01', itemId);
```

### Query Builder Usage
```typescript
// Use fluent interface
const users = await createQuery<User>()
  .withPartitionKey('pk', formatKey(EntityPrefix.USER, userId))
  .withSortKeyBeginsWith('sk', SecondaryPrefix.FOLLOWS)
  .withLimit(20)
  .execute();
```

### Transaction Patterns
```typescript
// Use helper for related items
const artist = await createRelatedItems(artistData, [
  // Related permissions, groups, etc.
]);
```

## Error Handling

### Custom Errors
```typescript
// Always use ApplicationError
throw new ApplicationError(
  ErrorCode.USER_NOT_FOUND,
  `User with ID ${userId} not found`
);

// In services, catch and re-throw with context
try {
  return await repository.getById(id);
} catch (error) {
  throw new ApplicationError(
    ErrorCode.USER_FETCH_FAILED,
    `Failed to fetch user: ${error.message}`
  );
}
```

### Validation
```typescript
// Use Zod schemas consistently
const CreateUserSchema = z.object({
  username: usernameSchema,
  email: emailSchema,
  displayName: createStringSchema({ minLength: 2, maxLength: 100 })
});

// Validate at service boundaries
export async function createUser(input: unknown): Promise<User> {
  const validated = CreateUserSchema.parse(input);
  // ... implementation
}
```

## Function Patterns

### Repository Functions
```typescript
// Always follow this pattern
export class UserRepository implements Repository<User> {
  async create(input: Omit<User, 'id' | 'createdAt' | 'updatedAt'>): Promise<User> {
    const id = await generatePrefixedId('user');
    const user: User = {
      ...input,
      id,
      ...addTimestamps()
    };
    
    await putItem(user);
    return user;
  }

  async getById(id: string): Promise<User | null> {
    return getByPrimaryKey<User>(EntityPrefix.USER, id);
  }
}
```

### Service Functions
```typescript
// Service layer handles business logic
export class ArtistService {
  constructor(
    private artistRepo: ArtistRepository,
    private managementRepo: ArtistManagementRepository,
    private karmaService: KarmaService
  ) {}

  async createArtist(input: CreateArtistInput, createdBy: string): Promise<Artist> {
    // Validate permissions
    await this.karmaService.checkPermission(createdBy, 'create_artist');
    
    // Create artist
    const artist = await this.artistRepo.create({
      ...input,
      createdBy
    });
    
    // Create management relationship
    await this.managementRepo.create({
      artistId: artist.id,
      userId: createdBy,
      permissions: { /* full permissions */ }
    });
    
    return artist;
  }
}
```

## Testing Patterns

### Repository Tests
```typescript
describe('UserRepository', () => {
  let repository: UserRepository;
  
  beforeEach(() => {
    repository = new UserRepository();
  });

  it('should create user with generated ID and timestamps', async () => {
    const input = {
      username: 'testuser',
      email: 'test@example.com',
      displayName: 'Test User'
    };
    
    const user = await repository.create(input);
    
    expect(user.id).toMatch(/^user_/);
    expect(user.createdAt).toBeDefined();
    expect(user.updatedAt).toBeDefined();
    expect(user.username).toBe(input.username);
  });
});
```

### Service Tests
```typescript
describe('ArtistService', () => {
  let service: ArtistService;
  let mockArtistRepo: jest.Mocked<ArtistRepository>;
  let mockKarmaService: jest.Mocked<KarmaService>;
  
  beforeEach(() => {
    mockArtistRepo = createMockRepository<Artist>();
    mockKarmaService = createMockKarmaService();
    service = new ArtistService(mockArtistRepo, mockKarmaService);
  });

  it('should check permissions before creating artist', async () => {
    const input = { name: 'Test Artist', artistType: ArtistType.VOCALIST };
    
    await service.createArtist(input, 'user123');
    
    expect(mockKarmaService.checkPermission).toHaveBeenCalledWith('user123', 'create_artist');
  });
});
```

## Import Conventions

### Absolute Imports
```typescript
// Use absolute imports for core modules
import { formatKey, EntityPrefix } from '@/shared/singleTable';
import { ApplicationError, ErrorCode } from '@/constants';
import type { User, Artist } from '@/types';

// Relative imports only within same domain
import { UserRepository } from './repository';
import { validateUserInput } from './validation';
```

### Export Patterns
```typescript
// Clean exports from index files
export { UserRepository } from './repository';
export { UserService } from './service';
export * from './types';
export * from './validation';

// Type-only exports when needed
export type { CreateUserInput, UpdateUserInput } from './types';
```

## Documentation

### JSDoc Comments
```typescript
/**
 * Create a new artist profile with management permissions
 * @param input - Artist creation data
 * @param createdBy - User ID of the creator
 * @returns Promise resolving to created artist
 * @throws ApplicationError when user lacks permissions
 */
async createArtist(input: CreateArtistInput, createdBy: string): Promise<Artist>
```

### README Pattern
Each domain should have:
- Purpose and responsibilities
- Key entities and relationships
- Usage examples
- Testing approach