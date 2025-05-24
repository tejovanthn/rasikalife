const database = new sst.aws.Dynamo('RasikaTable', {
  fields: {
    PK: 'string',
    SK: 'string',
    GSI1PK: 'string',
    GSI1SK: 'string',
    GSI2PK: 'string',
    GSI2SK: 'string',
    GSI3PK: 'string',
    GSI3SK: 'string',
    GSI4PK: 'string',
    GSI4SK: 'string',
    GSI5PK: 'string',
    GSI5SK: 'string',
    GSI6PK: 'string',
    GSI6SK: 'string',
  },
  primaryIndex: { hashKey: 'PK', rangeKey: 'SK' },
  globalIndexes: {
    GSI1: { hashKey: 'GSI1PK', rangeKey: 'GSI1SK' },
    GSI2: { hashKey: 'GSI2PK', rangeKey: 'GSI2SK' },
    GSI3: { hashKey: 'GSI3PK', rangeKey: 'GSI3SK' },
    GSI4: { hashKey: 'GSI4PK', rangeKey: 'GSI4SK' },
    GSI5: { hashKey: 'GSI5PK', rangeKey: 'GSI5SK' },
    GSI6: { hashKey: 'GSI6PK', rangeKey: 'GSI6SK' },
  },
});

export { database };
