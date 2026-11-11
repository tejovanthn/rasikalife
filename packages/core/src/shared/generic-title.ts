const GENERIC_PATTERNS = [
  /^(grand\s+)?(carnatic|hindustani|vocal|violin|veena|flute|instrumental|classical)\s+(music\s+)?concert(\s+by\s+.+)?$/i,
  /concert\s+by\s+(vid\.?|vidushi|sri|smt\.?|dr\.?)/i,
];

const normalise = (s: string) => s.toLowerCase().replace(/\s+/g, ' ').trim();

export function isGenericTitle(
  title: string,
  artists?: Array<{ name: string }>,
  artForm?: string
): boolean {
  const norm = normalise(title);
  if (GENERIC_PATTERNS.some(p => p.test(norm))) return true;

  const firstArtist = artists?.[0]?.name;
  if (!firstArtist) return false;

  const artist = normalise(firstArtist);
  return (
    norm === `concert by ${artist}` ||
    (!!artForm && norm === `${normalise(artForm)} concert by ${artist}`)
  );
}
