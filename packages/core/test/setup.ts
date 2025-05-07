/**
 * Global test setup for the core package
 */
import { vi } from 'vitest';
import { mockDynamoDBClient, mockDynamoDBDocumentClient } from './mocks/dynamodb';

// Set up the mock DynamoDB client
vi.mock('@aws-sdk/client-dynamodb', () => {
  return mockDynamoDBClient;
});

// Set up the mock DynamoDB Document client
vi.mock('@aws-sdk/lib-dynamodb', () => {
  return mockDynamoDBDocumentClient;
});

// Mock date functions for deterministic testing
vi.mock('../src/utils/dateTime', async () => {
  const actual = await vi.importActual('../src/utils/dateTime');
  return {
    ...actual,
    getCurrentISOString: () => '2025-01-15T12:00:00.000Z',
    formatDateYYYYMMDD: () => '2025-01-15'
  };
});

// Mock ID generation for deterministic testing
vi.mock('../src/utils/id', async () => {
  const actual = await vi.importActual('../src/utils/id');
  
  let idCounter = 1;
  
  return {
    ...actual,
    generateId: async () => `test_id_${idCounter++}`,
    generatePrefixedId: async (prefix: string) => `${prefix}_test_id_${idCounter++}`,
    generateIdSync: () => `test_id_${idCounter++}`,
    generateRandomString: (length: number = 6) => 'abcdef'.substring(0, length)
  };
});

// Global setup
beforeAll(() => {
  // Set a fixed time for all tests
  vi.setSystemTime(new Date('2025-01-15T12:00:00.000Z'));
});

// Global teardown
afterAll(() => {
  vi.useRealTimers();
  vi.resetAllMocks();
});

// Reset mock counters between tests
afterEach(() => {
  vi.clearAllMocks();
});