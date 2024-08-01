const database = new sst.aws.Dynamo('RasikaTable', {
  fields: {
    pk: 'string',
    sk: 'string',
    gsi1pk: 'string',
    gsi1sk: 'string',
    gsi2pk: 'string',
    gsi2sk: 'string',
    gsi3pk: 'string',
    gsi3sk: 'string',
    gsi4pk: 'string',
    gsi4sk: 'string',
    gsi5pk: 'string',
    gsi5sk: 'string',
    gsi6pk: 'string',
    gsi6sk: 'string',
  },
  primaryIndex: { hashKey: 'pk', rangeKey: 'sk' },
  globalIndexes: {
    GSI1: { hashKey: 'gsi1pk', rangeKey: 'gsi1sk' },
    GSI2: { hashKey: 'gsi2pk', rangeKey: 'gsi2sk' },
    GSI3: { hashKey: 'gsi3pk', rangeKey: 'gsi3sk' },
    GSI4: { hashKey: 'gsi4pk', rangeKey: 'gsi4sk' },
    GSI5: { hashKey: 'gsi5pk', rangeKey: 'gsi5sk' },
    GSI6: { hashKey: 'gsi6pk', rangeKey: 'gsi6sk' },
  },
});

export { database };
