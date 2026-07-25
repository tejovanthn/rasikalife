/**
 * `EventArtist.role` is free text lifted from posters and scrapes, so the
 * same instrument shows up spelled several ways ("Vocal" / "vocals" /
 * "vocalist"). This table collapses the spellings that actually occur in our
 * data to one canonical key per role, so collaborator "top roles" and any
 * other role-keyed aggregation see one entry instead of several.
 */
const ROLE_ALIASES: Record<string, string> = {
  vocal: 'vocal',
  vocals: 'vocal',
  vocalist: 'vocal',
  violin: 'violin',
  violinist: 'violin',
  mridangam: 'mridangam',
  mrudangam: 'mridangam',
  ghatam: 'ghatam',
  ghatom: 'ghatam',
  kanjira: 'kanjira',
  khanjira: 'kanjira',
  morsing: 'morsing',
  flute: 'flute',
  flautist: 'flute',
  veena: 'veena',
  veenai: 'veena',
  vainika: 'veena',
  tambura: 'tambura',
  tanpura: 'tambura',
  nagaswaram: 'nagaswaram',
  nadaswaram: 'nagaswaram',
  thavil: 'thavil',
  // `dance` stays free — collapsing it to bharatanatyam would mislabel Kuchipudi,
  // Kathak, Odissi, Mohiniyattam and Kathakali performers, which on an Indian
  // classical arts platform is exactly the kind of wrong assertion to avoid. An
  // unmapped "dance" passes through as "dance".
  bharatanatyam: 'bharatanatyam',
};

/**
 * Normalize a free-text role/instrument label to a single canonical key.
 *
 * Unrecognised input is lowercased and trimmed rather than dropped — an
 * instrument this table doesn't know about is still a real role, and hiding
 * it would lose information the table simply hasn't caught up with yet.
 */
export function canonicalRole(raw: string): string {
  const normalized = raw.toLowerCase().trim();
  return ROLE_ALIASES[normalized] ?? normalized;
}
