// Entity exports (server-side only - imports Node.js dependencies)
export { EditEntity } from './entity';

// Type exports (safe for browser import - no Node.js dependencies)
export * from './types';
export * from './diff';

// Service exports (server-side only)
export * from './registry';
export * from './service';
