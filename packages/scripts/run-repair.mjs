import { Resource } from 'sst';
process.env.DYNAMODB_TABLE = Resource.RasikaTable.name;
const apply = process.argv.includes('--apply');
console.log('table:', process.env.DYNAMODB_TABLE, apply ? '(APPLYING)' : '(dry run)');
const { repairUppercaseKeys } = await import('./src/repairUppercaseKeys.ts');
await repairUppercaseKeys({ apply });
