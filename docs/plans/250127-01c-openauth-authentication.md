# OpenAuth Authentication - SST Auth Integration

## Overview
Add optional authentication using SST Auth with Google OAuth. Zero custom auth logic - let SST handle everything.

## Requirements
- Optional Google OAuth login via SST Auth
- Enhanced user profiles (email, name, picture, Google ID)
- Server-first auth context via Remix loaders
- Login/logout buttons in header
- Site works fully without authentication
- User entity to track Google OAuth profile details

## Technical Design

### User Entity
Add user domain to `packages/core/src/domain/user/`:

```typescript
// types.ts
export interface User {
  id: string;
  email: string;
  name: string;
  picture?: string;
  googleId?: string;
  isVerified: boolean;
  createdAt: string;
  lastSignInAt: string;
  preferences?: Record<string, unknown>;
}

// schema.ts
import { z } from 'zod';

export const CreateUserSchema = z.object({
  email: z.string().email(),
  name: z.string().min(1).max(200),
  picture: z.string().url().optional(),
  googleId: z.string().optional(),
});

export const UpdateUserSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  picture: z.string().url().optional(),
  preferences: z.record(z.unknown()).optional(),
});
```

### ElectroDB Model
```typescript
// model.ts
import { Entity } from 'electrodb';
import { table } from '@/singleTable';

export const UserEntity = new Entity({
  model: {
    entity: 'USER',
    version: '1',
    service: 'rasika',
  },
  attributes: {
    id: { type: 'string', required: true },
    email: { type: 'string', required: true },
    name: { type: 'string', required: true },
    picture: { type: 'string', required: false },
    googleId: { type: 'string', required: false },
    isVerified: { type: 'boolean', required: true, default: false },
    createdAt: { type: 'string', required: true },
    lastSignInAt: { type: 'string', required: true },
    preferences: { type: 'map', required: false },
  },
  indexes: {
    primary: { pk: { field: 'PK', composite: ['id'] }, sk: { field: 'SK', composite: [] } },
    byEmail: { 
      index: 'GSI1', 
      pk: { field: 'GSI1PK', composite: ['email'] }, 
      sk: { field: 'GSI1SK', composite: ['id'] } 
    },
    byGoogleId: { 
      index: 'GSI2', 
      pk: { field: 'GSI2PK', composite: ['googleId'] }, 
      sk: { field: 'GSI2SK', composite: ['id'] } 
    },
  },
}, { table });
```

### UserRepository
```typescript
// repository.ts
import { UserEntity } from './model';
import { CreateUserSchema, UpdateUserSchema } from './schema';
import { createBaseItem, formatKey, EntityPrefix } from '@/shared/singleTable';

export class UserRepository {
  static async create(input: unknown): Promise<User> {
    const validated = CreateUserSchema.parse(input);
    const baseItem = await createBaseItem(EntityPrefix.USER);
    
    const user = await UserEntity.create({
      ...baseItem,
      ...validated,
      isVerified: true,
      lastSignInAt: baseItem.createdAt,
    }).go();
    
    return user.data;
  }

  static async findById(id: string): Promise<User | null> {
    const result = await UserEntity.get({ id }).go();
    return result.data || null;
  }

  static async findByEmail(email: string): Promise<User | null> {
    const result = await UserEntity.query.byEmail({ email }).go();
    return result.data[0] || null;
  }

  static async findByGoogleId(googleId: string): Promise<User | null> {
    const result = await UserEntity.query.byGoogleId({ googleId }).go();
    return result.data[0] || null;
  }

  static async update(id: string, input: unknown): Promise<User> {
    const validated = UpdateUserSchema.parse(input);
    
    const user = await UserEntity.update({ id })
      .set({ ...validated, lastSignInAt: new Date().toISOString() })
      .go();
    
    return user.data;
  }

  static async updateLastSignIn(id: string): Promise<User> {
    const user = await UserEntity.update({ id })
      .set({ lastSignInAt: new Date().toISOString() })
      .go();
    
    return user.data;
  }
}
```

### UserService
```typescript
// service.ts
import { UserRepository } from './repository';
import { ApplicationError, ErrorCode } from '@/constants';

export const findOrCreateUser = async (googleProfile: {
  email: string;
  name: string;
  picture?: string;
  sub: string; // Google ID
}): Promise<User> => {
  // Try to find by Google ID first
  let user = await UserRepository.findByGoogleId(googleProfile.sub);
  
  if (user) {
    // Update last sign-in and profile if changed
    return UserRepository.update(user.id, {
      name: googleProfile.name,
      picture: googleProfile.picture,
    });
  }
  
  // Try to find by email (existing user linking Google)
  user = await UserRepository.findByEmail(googleProfile.email);
  
  if (user) {
    // Link Google account and update profile
    return UserRepository.update(user.id, {
      name: googleProfile.name,
      picture: googleProfile.picture,
      googleId: googleProfile.sub,
    });
  }
  
  // Create new user
  return UserRepository.create({
    email: googleProfile.email,
    name: googleProfile.name,
    picture: googleProfile.picture,
    googleId: googleProfile.sub,
  });
};

export const getUserById = async (id: string): Promise<User> => {
  const user = await UserRepository.findById(id);
  if (!user) {
    throw new ApplicationError(ErrorCode.USER_NOT_FOUND, `User ${id} not found`);
  }
  return user;
};
```

### SST Auth Integration
Add SST Auth to `infra/site.ts`:

```typescript
const auth = new sst.aws.Auth('RasikaAuth', {
  google: {
    clientId: $secret.GOOGLE_CLIENT_ID,
    clientSecret: $secret.GOOGLE_CLIENT_SECRET,
  },
  onSuccess: async (event) => {
    // Find or create user from Google profile
    const { findOrCreateUser } = await import('./core/src/domain/user/service');
    await findOrCreateUser({
      email: event.properties.email!,
      name: event.properties.name!,
      picture: event.properties.picture,
      sub: event.properties.sub!,
    });
  },
});

// Link to site
const site = new sst.aws.React('RasikaWeb', {
  link: [bucket, trpc, auth],
  // ... rest unchanged
});
```

### Remix Root Loader
Add auth context to `app/root.tsx`:

```typescript
import { getUserById } from '@rasika/core';

export async function loader({ request }: LoaderFunctionArgs) {
  const session = await auth.api.getSession({
    headers: request.headers,
  });

  let user = null;
  if (session?.user?.userId) {
    try {
      user = await getUserById(session.user.userId);
    } catch {
      // User not found in DB, continue with null
    }
  }

  return json({
    theme: 'light', // existing
    user,
  });
}
```

### Header Component
Update `app/components/header.tsx` with login/logout:

```typescript
const Header = () => {
  const { user } = useLoaderData<typeof loader>();
  
  return (
    <header>
      {/* existing navigation */}
      <div className="ml-auto">
        {user ? (
          <div className="flex items-center gap-2">
            {user.picture && (
              <img src={user.picture} alt={user.name} className="w-8 h-8 rounded-full" />
            )}
            <span>{user.name}</span>
            <Form method="post" action="/auth/logout">
              <button type="submit">Logout</button>
            </Form>
          </div>
        ) : (
          <Link to="/auth/login">Login with Google</Link>
        )}
      </div>
    </header>
  );
};
```

### Auth Routes
Create `app/routes/auth.login.tsx`:

```typescript
import { redirect } from 'react-router';

export async function loader() {
  const authUrl = await auth.api.getAuthorizationUrl();
  return redirect(authUrl);
}
```

Create `app/routes/auth.logout.tsx`:

```typescript
import { redirect } from 'react-router';

export async function action({ request }: ActionFunctionArgs) {
  await auth.api.deleteSession({
    headers: request.headers,
  });
  return redirect('/');
}
```

### Auth Callback Route
Create `app/routes/auth.callback.tsx`:

```typescript
import { redirect } from 'react-router';

export async function loader({ request }: LoaderFunctionArgs) {
  await auth.api.authorize({
    headers: request.headers,
  });
  return redirect('/');
}
```

## Implementation Plan

### Phase 1: User Domain Setup
1. Create user domain: `packages/core/src/domain/user/`
2. Implement User entity with ElectroDB model
3. Add UserRepository with CRUD operations
4. Implement UserService with find/create/update logic
5. Add user domain tests

### Phase 2: SST Auth Setup
1. Add auth configuration to `infra/site.ts` with onSuccess callback
2. Set up Google OAuth secrets
3. Deploy and test auth endpoints

### Phase 3: Remix Integration
1. Add auth context to root loader with user lookup
2. Update header with login/logout UI
3. Create auth routes (login, logout, callback)
4. Test authentication flow with user creation

## Testing Strategy
- Test login/logout flow end-to-end
- Verify site works without authentication
- Check auth persistence across page reloads
- Validate user profile data display
- Test user creation on first sign-in
- Test user profile updates on subsequent sign-ins
- Test Google account linking for existing users
- Verify user lookup by ID, email, and Google ID

## Files Changed (3)
1. `infra/site.ts` - Add SST Auth configuration with user creation
2. `app/root.tsx` - Add auth context with user lookup  
3. `app/components/header.tsx` - Add login/logout UI

## Files Added (8)
1. `packages/core/src/domain/user/index.ts` - Barrel exports
2. `packages/core/src/domain/user/types.ts` - TypeScript interfaces
3. `packages/core/src/domain/user/schema.ts` - Zod validation schemas
4. `packages/core/src/domain/user/model.ts` - ElectroDB model
5. `packages/core/src/domain/user/repository.ts` - Data access layer
6. `packages/core/src/domain/user/service.ts` - Business logic layer
7. `app/routes/auth.login.tsx` - Redirect to Google OAuth
8. `app/routes/auth.logout.tsx` - Clear session
9. `app/routes/auth.callback.tsx` - Handle OAuth callback

## Open Questions
- Google OAuth app configuration
- Auth token expiration handling (SST manages automatically)
- User profile preferences structure (keep simple for now)