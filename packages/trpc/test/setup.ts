/**
 * tRPC Integration Test Setup
 *
 * This file configures integration testing for the tRPC API using real DynamoDB
 * through SST (Serverless Stack). Unlike unit tests that use mocks, these
 * integration tests run against actual AWS infrastructure in the dev environment.
 */

import { appRouter } from '../src/routers';
import type { Context } from '../src/context';
import { scan, deleteItem } from '@rasika/core';
import { afterEach } from 'vitest';

/**
 * Creates a standardized test context for tRPC router calls
 *
 * This context simulates an authenticated user making API requests.
 * The test user ID is used for data cleanup between tests.
 */
const createTestContext = (): Context => ({
  session: {
    user: {
      id: 'test-user-id', // Consistent test user for cleanup
      email: 'test@example.com',
    },
  },
  req: {
    headers: {},
    cookies: {},
  },
  res: {
    setHeader: () => {},
    status: () => {},
  },
  isBot: false, // Regular user context
});

/**
 * Main test router for integration tests
 *
 * This router instance simulates regular user requests and is used
 * for most test scenarios.
 */
export const testRouter = appRouter.createCaller(createTestContext());

/**
 * Bot test router for testing bot-specific behavior
 *
 * This router instance simulates bot requests (search engines, crawlers)
 * and is used to test features like view tracking that should behave
 * differently for bots vs. regular users.
 */
export const botTestRouter = appRouter.createCaller({
  ...createTestContext(),
  isBot: true, // Bot context for testing bot-specific behavior
});

/**
 * Automatic test data cleanup
 *
 * Since integration tests use real DynamoDB, we need to clean up
 * test data between tests to ensure test isolation. This cleanup:
 *
 * 1. Scans for all items created by the test user
 * 2. Deletes them to prevent test interference
 * 3. Handles cleanup failures gracefully with warnings
 *
 * Note: This approach works because all test entities include
 * the test user ID in their editedBy field.
 */
afterEach(async () => {
  try {
    // Find all test items (items created by test-user-id)
    const testItems = await scan({
      FilterExpression: 'contains(#editedBy, :testUserId)',
      ExpressionAttributeNames: {
        '#editedBy': 'editedBy',
      },
      ExpressionAttributeValues: {
        ':testUserId': 'test-user-id',
      },
    });

    // Delete all test items in parallel for efficiency
    const deletePromises = testItems.items.map(item => deleteItem({ PK: item.PK, SK: item.SK }));

    await Promise.all(deletePromises);
  } catch (error) {
    // Warn but don't fail tests if cleanup fails
    console.warn('Failed to cleanup test data:', error);
  }
});
