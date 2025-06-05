/**
 * DynamoDB client setup and configuration
 */
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient } from '@aws-sdk/lib-dynamodb';
// Default region from environment or fallback
const REGION = process.env.AWS_REGION || 'us-east-1';
// Default table name from environment or fallback
export const TABLE_NAME = (() => {
  // In test environment, use mock table name
  if (process.env.NODE_ENV === 'test' || process.env.VITEST) {
    return 'mock-rasika-table';
  }
  
  // In production/dev, use SST Resource
  try {
    const { Resource } = require('sst');
    return Resource.RasikaTable.name;
  } catch (error) {
    // Fallback if SST is not available
    return process.env.RASIKA_TABLE_NAME || 'rasika-table';
  }
})();

// Create the base DynamoDB client with optimized configuration
const ddbClient = new DynamoDBClient({
  region: REGION,
  // Connection and retry configuration for better performance
  maxAttempts: 3,
  // Support local development with DynamoDB Local
  ...(process.env.DYNAMODB_ENDPOINT && {
    endpoint: process.env.DYNAMODB_ENDPOINT,
  }),
});

// Create the DynamoDB document client
export const docClient = DynamoDBDocumentClient.from(ddbClient, {
  marshallOptions: {
    // Convert empty strings, sets, and lists to null
    convertEmptyValues: true,
    // Remove undefined values
    removeUndefinedValues: true,
    // Convert typeof object to map
    convertClassInstanceToMap: true,
  },
  unmarshallOptions: {
    // Convert empty strings back to empty strings instead of null
    wrapNumbers: false,
  },
});

/**
 * Get the table name to use for the current environment
 *
 * @param tableSuffix - Optional suffix to append to the table name
 * @returns The full table name
 */
export const getTableName = (tableSuffix?: string): string => {
  return tableSuffix ? `${TABLE_NAME}-${tableSuffix}` : TABLE_NAME;
};
