/**
 * "Narada Gana Sabha, Chennai": the venue with its city, for a row in a list that mixes cities.
 * The city is left off when it is unknown, or when the venue name already ends with it.
 */
export function venueLine(venueName: string, city?: string | null): string {
  const c = city?.trim();
  if (!c) return venueName;
  if (venueName.toLowerCase().includes(c.toLowerCase())) return venueName;
  return `${venueName}, ${c}`;
}
