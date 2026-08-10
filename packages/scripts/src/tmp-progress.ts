import { Resource } from 'sst';
process.env.DYNAMODB_TABLE = Resource.RasikaTable.name;
const { ArtistEntity } = await import('../../core/src/domain/artist/entity.js');
const rows = (await ArtistEntity.query.list({}).go({ pages: 'all',
  attributes: ['id','name','city','website','birthPlace','activeYears','specialisations','socialLinks'] })).data as any[];
const has = (f: string) => rows.filter(r => { const v = r[f]; return Array.isArray(v) ? v.length : String(v ?? '').trim(); }).length;
for (const f of ['city','website','birthPlace','activeYears','specialisations','socialLinks']) console.log('  ', f.padEnd(16), has(f));
const failed = ['Janardhan','H N Bhaskar','Bhanu Priya Rakesh','Abraham Panditar','H. YOganarasimham',
  'Sai Shiv Lakshmi Keshav','Changanassery Harikumar','Amit Nadig','Puliyoor Shree Duraiswaami Aiyyar','Ishika'];
console.log('\n--- the 10 rows that errored ---');
for (const n of failed) {
  const r = rows.find(x => x.name === n);
  if (!r) { console.log('  ', n, '(not found)'); continue; }
  const filled = ['city','website','birthPlace','activeYears','specialisations','socialLinks']
    .filter(f => { const v = r[f]; return Array.isArray(v) ? v.length : String(v ?? '').trim(); });
  console.log('  ', n.slice(0,34).padEnd(36), filled.length ? filled.join(', ') : '(nothing stored)');
}
