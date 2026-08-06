import { writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * Write the map the melakarta chakra widget renders from.
 *
 * The 72 canonical melakarta records do not carry a `melaNumber` in the
 * database, and their stored names are wildly inconsistent (`shankarAbharaNa`,
 * `gavAmbOdhi`, `ratnaangi`, ...), so they cannot be resolved by name or number
 * at build time. The `ids` below were resolved once from a production export
 * (match by arohanam against `data/ragas.json`, then by name/alternate spelling)
 * and are now the source of truth.
 *
 * Output is a plain map written to the web app so page loads make no extra
 * queries. Regenerate whenever the canonical records change.
 */

type MelakartaLink = { id: string; name: string };

const DEFAULT_OUT = resolve(
  fileURLToPath(new URL('../../web/app/lib/melakarta-links.ts', import.meta.url))
);

/** Mela number → canonical raga record in the database, resolved from prod data. */
const MELAKARTA_SOURCE: Record<number, MelakartaLink> = {
  1: { id: '38bEs9GHonNHZ3SW05bjS10m7OY', name: 'kanakAngi' },
  2: { id: '38axss3waCraJyIRLL7oAkJ7jbI', name: 'ratnAngi' },
  3: { id: '38bIfl0896S84r70WDYhg2VuOnL', name: 'gAnamUrti' },
  4: { id: '38axt8ColAZwzccnpPGukiLuFZm', name: 'vanaspati' },
  5: { id: '38axtLRlADKRPMpUmoCjH2UrwMA', name: 'mAnavati' },
  6: { id: '38bJHFxk9YTImxnXmFMT3LMDFnx', name: 'tAnarUpi' },
  7: { id: '38bJ7XOLyFMBk77o2sLnQj4ZFks', name: 'sEnAvati' },
  8: { id: '38axTjzjliASR5AbVudtFoJ3hn7', name: 'tODi' },
  9: { id: '38axU1N7tO5imVMVy8ao3t5Y1mM', name: 'dhEnukA' },
  10: { id: '38b77y5u8A6rLzLuYGdkKprldDZ', name: 'nATakapriyA' },
  11: { id: '38b92J9LZg2Cynx22VLJJwJeIZC', name: 'kOkilapriyA' },
  12: { id: '38bEudDkocFQh3psbkzDeI2KJLm', name: 'rUpavati' },
  13: { id: '38axuweMksodreabWw2omlTmRZG', name: 'gAyakapriyA' },
  14: { id: '38b8weaHTWGjEqglIOYwV4pa3mR', name: 'vakulAbharaNam' },
  15: { id: '38avrT3w1jrhenOU6klMrm1TdCi', name: 'mAyamALava gowLa' },
  16: { id: '38b900ZTPBQzzfQm2wKtqbEwhWu', name: 'cakravAkam' },
  17: { id: '38bEDqZu8zaC1DQ8YtcPMz1SWRI', name: 'sUryakAntam' },
  18: { id: '38bI6Be3JM4uO6bZ0At7RpWSOFP', name: 'hATakAmbari' },
  19: { id: '38bELkP8X3J8GFQTzRebtg7OSmG', name: 'jhankAradhwani' },
  20: { id: '38axw6knWdj4PBSco71delKs7Ts', name: 'naTabhairavi' },
  21: { id: '38b8q85UP7FDQIv5fPFJQAyqr4x', name: 'kIravANi' },
  22: { id: '38avMmk0wVmOsfNCaSkx6hnjI4f', name: 'kharaharapriyA' },
  23: { id: '38axi9fpSGhKwgxBwH2lpNLSBQh', name: 'gowri manOhari' },
  24: { id: '38b9Xj9tt2iMhq2QVsBJqlbII1A', name: 'varuNapriyA' },
  25: { id: '38axwsQvNUSjh3lIREkUuH5HxzH', name: 'mAraranjani' },
  26: { id: '38b8c0US8gNwhWmhmKO5JcTsmt1', name: 'cArukEshi' },
  27: { id: '38b5YvIvB1ug5BLMZ01DFr6yni9', name: 'sarasAngi' },
  28: { id: '38awAuabQBrPY88jiAv0CQ6EGyY', name: 'harikAmbhOji' },
  29: { id: '38avDJDMmEf9abwnF4AC783hmRX', name: 'shankarAbharaNam' },
  30: { id: '38bI4ZwP3oWXJO84V6Wa84A8brQ', name: 'nAganandini' },
  31: { id: '38bJLYrZVDmcwL1bIFif5XMsSeA', name: 'yAgapriyA' },
  32: { id: '38axy8OV4ghjeCc08MmC378Wgzc', name: 'rAgavardhani' },
  33: { id: '38bF8eLhcigaXwcVhrwtfDA9VuC', name: 'gangayabhUshhani' },
  34: { id: '38bJTYGL5Me3F3DFjozbRGqWSig', name: 'vAgadIshwari' },
  35: { id: '38bHsecvjYQstK5xA8p1lmr7EXR', name: 'shUlini' },
  36: { id: '38bEiKsNfOdz70ohudJSr48qALq', name: 'calanATTai' },
  37: { id: '38bJPatGy66HxIelLZXxWFiBpxL', name: 'sAlagam' },
  38: { id: '38bHqum5yMSLKmz6s4u6kQXbtw7', name: 'jalArnavam' },
  39: { id: '38axzVsxdqPdXz0zWsspaFHEOMM', name: 'jhAlavarALi' },
  40: { id: '38axzcjojxkyM0zkUjYAzLRuazm', name: 'navanItam' },
  41: { id: '38bIxJ9GE5jDfHMZWCGRIyOLzwM', name: 'pAvani' },
  42: { id: '38bIv2yik5Jww1rv9J8byjyasxH', name: 'raghupriyA' },
  43: { id: '38bJ9Wm4uJcN4GPb2CpFOae6vup', name: 'ghavAmbhodi' },
  44: { id: '38b9WM2kSTUIRWFkRoQt9RLeEbQ', name: 'bhAvapriyA' },
  45: { id: '38b8rAPTgE6AAirX1YI0q9CDwK4', name: 'shubhapantuvarALi' },
  46: { id: '38bETWvdvnkWc0KUo01etxwtT2N', name: 'shhadvidamArgini' },
  47: { id: '38ay5Po2wcFAexBRUGVIsCkZBxg', name: 'suvarnAngi' },
  48: { id: '38ay5Z7FEyT0fje1AXoBcb5U4VB', name: 'divyAmaNi' },
  49: { id: '38ay5pM0If8w9ZKzCCKx70dDUIv', name: 'dhavalAmbari' },
  50: { id: '38bEbDbkgxL8nBdvfGGzxl6pEBG', name: 'nAmanArAyaNi' },
  51: { id: '38bEXOq992q9HsrrbjXJsx0U633', name: 'pantuvarALi' },
  52: { id: '38b8SaZn97quka2l1HLQhUgea5H', name: 'rAmapriyA' },
  53: { id: '38az3C0ffzGh39RldybmJlF0NCX', name: 'gamanashramA' },
  54: { id: '3A73T5WZYltoVzLlL5TXuyrElK7', name: 'vishvAmbhari' },
  55: { id: '38bJDaf2uQdrCvF1wYXkDKR0d8k', name: 'shyAmaLAngi' },
  56: { id: '38aw6th7wBjwZp1yHVZ0ejys8BN', name: 'shhanmugapriyA' },
  57: { id: '38avI9lImYfOZf6LXoJvHcHpBAr', name: 'simhEndra madhyamam' },
  58: { id: '38az5PsWVwNN74DX8mDdcCqPlxT', name: 'hEmAvati' },
  59: { id: '38avKwDVVNFTvMOg2eavMsVdZae', name: 'dharmAvati' },
  60: { id: '38b8hb2qmpUeJMscs12PG3H0XL4', name: 'nItimati' },
  61: { id: '38ay7oflULbMfifizFld7gHybUK', name: 'kAntAmaNi' },
  62: { id: '38bEWrqs9sdjS5zLGACQKCtHYuV', name: 'rishhabhapriyA' },
  63: { id: '38b8TazCbCXZiJvFW5xBomRhEtU', name: 'latAngi' },
  64: { id: '38b6KKtGZRu4uw4rL5OaHpygVME', name: 'vAcaspati' },
  65: { id: '38avRxJjxIoOjNeaorNfJDJFWRm', name: 'kalyANi' },
  66: { id: '38bHqhCG0cRPMG7DWn7pWDuN6BZ', name: 'citrAmbari' },
  67: { id: '38ay8rBUQKisB3RJ2Fkhs7Nt963', name: 'sucaritra' },
  68: { id: '38bEgjB1fX06fUW4fVyUX8FBgoj', name: 'jyOtiswarUpini' },
  69: { id: '38bEXroFLdCFz0XYDo87MGrytoI', name: 'dhAtuvardhani' },
  70: { id: '38bJQfTeqQRrtb6waC8eOsuB4x8', name: 'nAsikabhUshhaNi' },
  71: { id: '38bISfAzG2ygj8BOjUc056Fom9g', name: 'koshalam' },
  72: { id: '38bHVqiobwcEtJTb6J7DmwOnBy9', name: 'rasikapriyA' },
};

export async function generateMelakartaLinks(opts?: { out?: string }): Promise<void> {
  const out = opts?.out ?? DEFAULT_OUT;

  const entries = Object.entries(MELAKARTA_SOURCE).sort((a, b) => Number(a[0]) - Number(b[0]));
  if (entries.length !== 72) {
    throw new Error(`Expected 72 melakartas, found ${entries.length}`);
  }

  const lines = [
    '// Generated by `pnpm prod-cli generate-melakarta-links`. Do not edit by hand.',
    '',
  ];
  lines.push('// Maps each melakarta number (1-72) to the canonical raga record in the database.');
  lines.push('export const MELAKARTA_LINKS: Record<number, { id: string; name: string }> = {');
  for (const [mela, link] of entries) {
    lines.push(`  ${mela}: { id: '${link.id}', name: '${link.name}' },`);
  }
  lines.push('};');
  lines.push('');

  writeFileSync(out, lines.join('\n'), 'utf-8');
  console.log(`✅ Wrote ${entries.length} melakartas to ${out}`);
}
