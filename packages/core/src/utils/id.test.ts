import { describe, it, expect, beforeAll } from 'vitest';
import { 
  generateId, 
  generatePrefixedId, 
  generateIdSync, 
  generateRandomString, 
  getTimestampFromId 
} from './id';

describe('ID utilities', () => {
  beforeEach(() => {
    vi.unmock("./id")
  })

  it('generates a valid KSUID', async () => {
    const id = await generateId();
    expect(id).toMatch(/^[0-9a-zA-Z]{27}$/);
  });

  it('generates a prefixed ID with the correct format', async () => {
    const id = await generatePrefixedId('user');
    expect(id).toMatch(/^user_[0-9a-zA-Z]{27}$/);
  });

  it('generates a valid KSUID synchronously', () => {
    const id = generateIdSync();
    expect(id).toMatch(/^[0-9a-zA-Z]{27}$/);
  });

  it('generates a random string of the specified length', () => {
    const str = generateRandomString(8);
    expect(str).toHaveLength(8);
    expect(str).toMatch(/^[0-9a-f]{8}$/);
  });

  it('extracts timestamp from KSUID', async () => {
    const id = await generateId();
    const timestamp = getTimestampFromId(id);
    
    // The timestamp should be recent (within the last minute)
    const now = new Date();
    const diff = now.getTime() - timestamp.getTime();
    expect(diff).toBeLessThan(60000); // Less than 1 minute
  });

  it('extracts timestamp from prefixed KSUID', async () => {
    const id = await generatePrefixedId('user');
    const timestamp = getTimestampFromId(id);
    
    // The timestamp should be recent (within the last minute)
    const now = new Date();
    const diff = now.getTime() - timestamp.getTime();
    expect(diff).toBeLessThan(60000); // Less than 1 minute
  });

  it('throws an error for invalid KSUIDs', () => {
    expect(() => getTimestampFromId('invalid-id')).toThrow();
  });
});