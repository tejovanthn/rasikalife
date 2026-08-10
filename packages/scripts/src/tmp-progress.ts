import { Resource } from 'sst';
process.env.DYNAMODB_TABLE = Resource.RasikaTable.name;
const { ArtistEntity } = await import('../../core/src/domain/artist/entity.js');
const rows = (await ArtistEntity.query.list({}).go({ pages: 'all',
  attributes: ['id', 'name', 'city', 'website', 'birthPlace', 'activeYears', 'updatedAt'] })).data as any[];
const has = (f: string) => rows.filter(r => String(r[f] ?? '').trim()).length;
console.log('artists:', rows.length);
for (const f of ['city', 'website', 'birthPlace', 'activeYears']) console.log('  ', f.padEnd(14), has(f));
const today = rows.filter(r => (r.updatedAt ?? '') > '2026-08-10T08:00:00').length;
console.log('  updated since import start:', today);
