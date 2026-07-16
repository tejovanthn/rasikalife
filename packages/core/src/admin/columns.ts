/**
 * Declarative CSV column registry shared by the admin export/import tool. Browser-safe:
 * only depends on the RFC 4180 `csv` primitives and operates on plain objects, so it can
 * be imported by web route modules that get bundled for the client.
 *
 * Each domain maps to an ordered list of columns. A column knows how to render an entity
 * field to a CSV cell (`get`) and how to fold a cell back into a plain row object (`set`).
 * The resulting row objects are handed to `bulkUpsertForDomain` on the server, which
 * resolves any name references to ids and validates against the domain Zod schemas.
 *
 * Encoding conventions:
 *   - list fields      -> pipe-joined, e.g. `ac|parking`
 *   - closed-set lists -> one yes/no column per allowed value (see `flags`)
 *   - address          -> `address_street`, `address_city`, ... columns
 *   - socialLinks      -> pipe-joined `platform:url` pairs (split on the first colon)
 *   - linked entities  -> the linked entity's name (a blank/new name is created on import)
 *   - nested objects   -> JSON in a single cell (lyrics, ticketing, tala structure, sponsors)
 */
import { VENUE_AMENITIES } from '../domain/venue/schema';
import { parseCsv, toCsv } from './csv';

type Entity = Record<string, unknown>;
type Row = Record<string, unknown>;

export interface Column {
  header: string;
  get: (entity: Entity) => string;
  /** Folds a trimmed cell into the row. Returns an error message when the cell is invalid. */
  set: (row: Row, raw: string) => string | undefined;
}

const readStr = (value: unknown): string => (value == null ? '' : String(value));
const refName = (value: unknown): string => readStr((value as { name?: string } | undefined)?.name);
const namesOf = (value: unknown): string[] =>
  Array.isArray(value) ? value.map(item => refName(item)).filter(Boolean) : [];
const splitList = (raw: string): string[] =>
  raw
    .split('|')
    .map(part => part.trim())
    .filter(Boolean);

function str(field: string): Column {
  return {
    header: field,
    get: entity => readStr(entity[field]),
    set: (row, raw) => {
      if (raw !== '') row[field] = raw;
      return undefined;
    },
  };
}

function num(field: string): Column {
  return {
    header: field,
    get: entity => (entity[field] == null ? '' : String(entity[field])),
    set: (row, raw) => {
      if (raw === '') return undefined;
      const value = Number(raw);
      if (!Number.isFinite(value)) return `${field}: not a number "${raw}"`;
      row[field] = value;
      return undefined;
    },
  };
}

function list(field: string): Column {
  return {
    header: field,
    get: entity => (Array.isArray(entity[field]) ? (entity[field] as string[]).join('|') : ''),
    set: (row, raw) => {
      if (raw !== '') row[field] = splitList(raw);
      return undefined;
    },
  };
}

const TRUTHY_CELLS = new Set(['yes', 'y', 'true', '1', 'x']);
const FALSY_CELLS = new Set(['no', 'n', 'false', '0']);

/**
 * Explodes a closed-set list field into one column per allowed value, mirroring the
 * checkbox grid on the web form: `amenities_ac`, `amenities_parking`, ... Each cell is
 * `yes` when the value is present and blank when it isn't, so the headers themselves
 * document the legal values and a spreadsheet editor never has to spell a slug.
 *
 * Import semantics follow the rest of the registry, where a blank cell means "leave
 * alone": the field is only written when at least one of its columns is non-blank. An
 * explicit falsy cell (`no`) therefore both clears the field and opts the row in to
 * being managed, which is the only way to empty an existing list from CSV.
 */
function flags(field: string, values: readonly string[]): Column[] {
  return values.map(value => ({
    header: `${field}_${value}`,
    get: entity =>
      Array.isArray(entity[field]) && (entity[field] as string[]).includes(value) ? 'yes' : '',
    set: (row, raw) => {
      if (raw === '') return undefined;
      const cell = raw.toLowerCase();
      if (TRUTHY_CELLS.has(cell)) {
        const current = (row[field] as string[] | undefined) ?? [];
        current.push(value);
        row[field] = current;
        return undefined;
      }
      if (FALSY_CELLS.has(cell)) {
        row[field] ??= [];
        return undefined;
      }
      return `${field}_${value}: expected yes or no, got "${raw}"`;
    },
  }));
}

function socialLinks(field: string): Column {
  return {
    header: field,
    get: entity => {
      const value = entity[field];
      if (!Array.isArray(value)) return '';
      return value
        .map(link => `${(link as { platform: string }).platform}:${(link as { url: string }).url}`)
        .join('|');
    },
    set: (row, raw) => {
      if (raw === '') return undefined;
      row[field] = splitList(raw)
        .map(pair => {
          const colon = pair.indexOf(':');
          return { platform: pair.slice(0, colon).trim(), url: pair.slice(colon + 1).trim() };
        })
        .filter(link => link.platform && link.url);
      return undefined;
    },
  };
}

function json(field: string): Column {
  return {
    header: field,
    get: entity => {
      const value = entity[field];
      if (value == null || (Array.isArray(value) && value.length === 0)) return '';
      return JSON.stringify(value);
    },
    set: (row, raw) => {
      if (raw === '') return undefined;
      try {
        row[field] = JSON.parse(raw);
        return undefined;
      } catch {
        return `${field}: invalid JSON`;
      }
    },
  };
}

function address(field = 'address'): Column[] {
  const parts = ['street', 'city', 'state', 'postalCode', 'country'] as const;
  return parts.map(part => ({
    header: `${field}_${part}`,
    get: entity => readStr((entity[field] as Record<string, unknown> | undefined)?.[part]),
    set: (row, raw) => {
      if (raw === '') return undefined;
      const current = (row[field] as Record<string, string> | undefined) ?? {};
      current[part] = raw;
      row[field] = current;
      return undefined;
    },
  }));
}

/** A single linked entity stored as a nested `{ id, name }` object (e.g. composer). */
function ref(header: string, entityField: string, rowKey: string): Column {
  return {
    header,
    get: entity => refName(entity[entityField]),
    set: (row, raw) => {
      if (raw !== '') row[rowKey] = raw;
      return undefined;
    },
  };
}

/** A single linked entity stored as a flat denormalized name string (e.g. venueName). */
function refFlat(header: string, nameField: string): Column {
  return {
    header,
    get: entity => readStr(entity[nameField]),
    set: (row, raw) => {
      if (raw !== '') row[nameField] = raw;
      return undefined;
    },
  };
}

/** Many linked entities, pipe-joined by name. */
function refList(header: string, entityField: string, rowKey: string): Column {
  return {
    header,
    get: entity => namesOf(entity[entityField]).join('|'),
    set: (row, raw) => {
      if (raw !== '') row[rowKey] = splitList(raw);
      return undefined;
    },
  };
}

const flat = (...columns: (Column | Column[])[]): Column[] => columns.flat();

export interface DomainCsvConfig {
  label: string;
  columns: Column[];
}

export const ADMIN_CSV_DOMAINS: Record<string, DomainCsvConfig> = {
  artist: {
    label: 'Artists',
    columns: flat(
      str('id'),
      str('name'),
      str('title'),
      refList('gurus', 'gurus', 'guruNames'),
      str('biography'),
      list('specialisations'),
      num('birthYear'),
      str('birthPlace'),
      str('website'),
      socialLinks('socialLinks'),
      str('activeYears')
    ),
  },
  raga: {
    label: 'Ragas',
    columns: flat(
      str('id'),
      str('name'),
      str('description'),
      str('tradition'),
      str('arohanam'),
      str('avarohanam'),
      list('alternateScales'),
      str('rasa'),
      str('timeOfDay'),
      str('season'),
      num('melaNumber'),
      ref('parentRaga', 'parentRaga', 'parentRagaName')
    ),
  },
  tala: {
    label: 'Talas',
    columns: flat(
      str('id'),
      str('name'),
      str('description'),
      str('tradition'),
      num('aksharas'),
      json('angaStructure')
    ),
  },
  composition: {
    label: 'Compositions',
    columns: flat(
      str('id'),
      str('title'),
      ref('composer', 'composer', 'composerName'),
      str('language'),
      refList('ragas', 'ragas', 'ragaNames'),
      refList('talas', 'talas', 'talaNames'),
      str('compositionType'),
      str('description'),
      str('meaning'),
      str('sourceAttribution'),
      json('lyricsV1')
    ),
  },
  venue: {
    label: 'Venues',
    columns: flat(
      str('id'),
      str('name'),
      address(),
      str('mapLink'),
      str('description'),
      str('venueType'),
      num('capacity'),
      str('website'),
      str('phone'),
      str('email'),
      str('photoUrl'),
      flags('amenities', VENUE_AMENITIES),
      str('nearestTransit'),
      num('foundedYear'),
      socialLinks('socialLinks')
    ),
  },
  organiser: {
    label: 'Organisers',
    columns: flat(
      str('id'),
      str('name'),
      str('description'),
      str('organisationType'),
      str('city'),
      address(),
      str('website'),
      str('phone'),
      str('email'),
      socialLinks('socialLinks'),
      num('foundedYear'),
      str('logoUrl'),
      list('tags'),
      refFlat('venue', 'venueName')
    ),
  },
  festival: {
    label: 'Festivals',
    columns: flat(
      str('id'),
      str('name'),
      str('description'),
      str('startDate'),
      str('endDate'),
      str('posterUrl'),
      refFlat('organiser', 'organiserName'),
      list('tags'),
      json('sponsors')
    ),
  },
  award: {
    label: 'Awards',
    columns: flat(
      str('id'),
      str('name'),
      str('description'),
      num('rank'),
      refFlat('issuingOrganisation', 'issuingOrganisationName'),
      str('frequency'),
      str('category')
    ),
  },
  event: {
    label: 'Events',
    columns: flat(
      str('id'),
      str('title'),
      str('description'),
      str('startDateTime'),
      str('endDateTime'),
      str('timezone'),
      refFlat('venue', 'venueName'),
      refFlat('organiser', 'organiserName'),
      str('festivalId'),
      refList('artists', 'artists', 'artistNames'),
      str('artForm'),
      list('tags'),
      str('entryType'),
      str('posterUrl'),
      json('ticketing'),
      json('contactInfo'),
      json('sponsors')
    ),
  },
};

export type AdminCsvDomain = keyof typeof ADMIN_CSV_DOMAINS;

export const ADMIN_CSV_DOMAIN_KEYS = Object.keys(ADMIN_CSV_DOMAINS);

export function domainToCsv(domain: string, entities: Entity[]): string {
  const config = ADMIN_CSV_DOMAINS[domain];
  if (!config) throw new Error(`Unknown CSV domain: ${domain}`);
  const header = config.columns.map(column => column.header);
  const rows = entities.map(entity => config.columns.map(column => column.get(entity)));
  return toCsv([header, ...rows]);
}

export interface ParsedDomainCsv {
  rows: Row[];
  errors: string[];
}

export function parseDomainCsv(domain: string, text: string): ParsedDomainCsv {
  const config = ADMIN_CSV_DOMAINS[domain];
  if (!config) throw new Error(`Unknown CSV domain: ${domain}`);

  const table = parseCsv(text);
  if (table.length === 0) return { rows: [], errors: ['The CSV is empty.'] };

  const header = table[0].map(column => column.trim());
  const rows: Row[] = [];
  const errors: string[] = [];

  for (let r = 1; r < table.length; r++) {
    const cells = table[r];
    if (cells.every(cell => cell.trim() === '')) continue;

    const lineNumber = r + 1;
    const row: Row = {};

    for (const column of config.columns) {
      const index = header.indexOf(column.header);
      if (index === -1) continue;
      const error = column.set(row, (cells[index] ?? '').trim());
      if (error) errors.push(`Line ${lineNumber}: ${error}`);
    }

    if (!row.id && !row.name && !row.title) {
      errors.push(`Line ${lineNumber}: skipped — row needs an id, name, or title.`);
      continue;
    }

    rows.push(row);
  }

  return { rows, errors };
}
