import type { SourceRecord } from '@rasika/core/domain/composition/source-import';

/**
 * One outside archive of compositions. An adapter only knows how to download its archive
 * and read it into `SourceRecord`s; matching, review, apply and undo are shared
 * (`sourceImport.ts`). To add a source, write an adapter and register it in `index.ts`.
 */
export interface SourceAdapter {
  /** The `--source` value, and the folder name under `data/sources/`. */
  name: string;
  /**
   * How the source spells titles and lyrics. `itrans` is stored as is. `plain` (ordinary
   * English romanisation) is lowercased for a new record, since capitals mean retroflex
   * letters in ITRANS; the respelling readers fix it properly afterwards.
   */
  romanisation: 'itrans' | 'plain';
  /** Downloads into `outDir`, cached, so a rerun fetches only what is missing. */
  fetch(outDir: string): Promise<void>;
  /** Reads what `fetch` left in `outDir`. */
  load(outDir: string): SourceRecord[];
}
