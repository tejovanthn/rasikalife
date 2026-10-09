# Raga dedupe, October 2026

Status: **reviewed, not applied.** Waiting for the owner's approval of the list.

- List: `docs/research/raga-dedupe-2026-10.csv`, one row per pair, most-searched first.
- Built by `pnpm prod-cli dedup-ragas --out docs/research/raga-dedupe-2026-10.csv --impressions data/gsc-raga-pages-2026-10-09.json`.
- Impressions: Search Console, page dimension, 2026-07-11 to 2026-10-09, all slugs of one id summed.

## Result

75 candidate pairs from 1,526 live ragas (all spelling variants; no exact-name duplicates are left).

| Suggestion | Pairs | Meaning |
|---|---|---|
| merge | 67 | One raga. 36 have matching scales on both sides (`high`); 28 differ only in transliteration with nothing contradicting (`medium`, reviewed); 3 were flagged `low` on a parent spelled two ways and reviewed to merge |
| review | 6 | Same or near-same name, but the stored data disagrees. Check the scales before merging |
| skip | 2 | False matches: Atana/Atan, Sudda/Sudha |

The `decision` column is empty on purpose. Write `merge` in it for each approved row.

### Not suggested for merge

| Suggestion | Survivor (impressions) | Loser (impressions) | Why |
|---|---|---|---|
| review | shree raagam (310) | shrIrAgam (87) | Same name (Sri ragam); stored avarohanam differs. `shree` and `shrI` (mela 22) may be the same raga too |
| review | sooryakaantam (77) | sUryakAnta (48) | Melakarta 17 name; stored scales differ |
| review | naasikabhooshhaNi (14) | nAsikAbhUSaNi (12) | Melakarta 70 name; stored scales differ |
| review | sindhubhairavi (24) | sindu bhairavi (1) | Same name; stored scales differ; loser has 0 compositions |
| review | vijayashree (10) | vijayashrI (0) | Stored scales differ; may be two ragas |
| review | kuntalashrIkaNThi (1) | kuntalashrIkAnti (0) | kaNThi and kAnti are different words |
| skip | aThANA (26) | atan (15) | Different ragas |
| skip | sudda (4) | sudhA (2) | Different ragas |

## What a merge does

`mergeRaga(loser, survivor)`, the same function the moderator merge page uses:

1. Re-points each composition junction from the loser to the survivor and rewrites the composition's stored raga list.
2. Copies every field the survivor lacks from the loser. Blanks only.
3. Re-points janya ragas whose parent is the loser.
4. Soft-deletes the loser with `mergedIntoId`. Its URL then returns a 301 to the survivor.

It does not move concert-log performances (none exist on these 67 losers) and does not reindex.

## Dry run against production (read-only, 2026-10-09)

67 pairs, 0 skipped. 405 compositions re-pointed, none already on the survivor, 0 performances,
32 janya ragas re-parented, and 17 survivors gain fields from the loser. The largest:

- `kIravANi` into `keeravaaNi` (melakarta 21): 32 compositions, 18 janya children, survivor gains its scale and mela number.
- `hamsadhvani` into `hamsadwani`: 63 compositions.
- `shrI` into `shree`: 60 compositions.

Per-pair detail: `data/raga-dedupe-2026-10.dry-run-input.csv.dry-run.json` (gitignored).

## Running it after approval

```sh
cd packages/scripts
pnpm prod-cli dedup-ragas --apply --file ../../docs/research/raga-dedupe-2026-10.csv --dry-run
pnpm prod-cli dedup-ragas --apply --file ../../docs/research/raga-dedupe-2026-10.csv
# then: reindex search, and
pnpm prod-cli generate-melakarta-links
```

`gAnamUrti` (3), `kIravANi` (21) and `vAgadIshvari` (34) are the melakarta map's records today
and would be merged away, so regenerate the map and commit it before deploying.

## Undo

There is no automatic undo. The apply run writes `raga-dedupe-2026-10.csv.applied.json` with each
pair's moved composition ids, re-parented children and filled fields. To reverse a pair by hand:
clear `deletedAt` and `mergedIntoId` on the loser, move those junctions and children back, and
blank the filled fields on the survivor.
