/**
 * DynamoDB client setup and configuration
 */
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient } from '@aws-sdk/lib-dynamodb';

// Default region from environment or fallback
const REGION = process.env.AWS_REGION || 'ap-south-1';
// Default table name from environment or fallback
export const TABLE_NAME = process.env.TABLE_NAME || 'RasikaTable';

// Create the base DynamoDB client
const ddbClient = new DynamoDBClient({
  region: REGION,
  ...(process.env.IS_LOCAL === 'true' && {
    endpoint: process.env.DYNAMODB_ENDPOINT || 'http://localhost:8000',
    credentials: {
      accessKeyId: 'LOCAL',
      secretAccessKey: 'LOCAL',
    },
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
  const tablename = tableSuffix ? `${TABLE_NAME}-${tableSuffix}` : TABLE_NAME;
};