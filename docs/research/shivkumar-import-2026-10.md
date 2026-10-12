# shivkumar.org import review (2026-10-12)

**Applied 2026-10-12:** 391 matches attached in prod (390 with notation, 1,832 links), 0
errors, reindexed. Undo record: `shivkumar-import-2026-10.applied.json` beside this note. 24
new songs are held for review; 3 rows skipped. Each row's `review_note` says why.

How the decisions were made: every suggested attach was checked by comparing his lyrics with
ours word by word (spelling folded). That caught one wrong match (Sri Ramachandra). The review
rows were attached where the lyrics are the same and only the raga name, composer spelling or
attribution differs. The proposed new songs were searched against all our lyrics: 20 of 29
already existed under another title and were attached instead, so no duplicates were made.

Shivkumar Kalyanaraman's lesson archive (https://www.shivkumar.org/music/) matched against
prod. CLAUDE.md, "Composition sources, and importing an outside source", describes the
pipeline. The review file is `shivkumar-matches-2026-10.csv` beside this note.

## What the archive holds

- 418 lessons after removing the 35 that the index lists twice: about 380 krithis, plus 38
  varnams, geethams and swarajatis. Sarali, janta and alankaram drills and the Vishnu
  Sahasranamam are left out.
- 409 lessons come from the PDF (`pdftotext -layout`, columns kept), 7 from the HTML page
  (dead PDF link), and 2 have no text at all (Alamelu Manga Nee, mAtE malaya dvaja: both
  links are dead on his side).

## Suggestions

| suggestion | confidence | rows | what it means |
|---|---|---|---|
| attach | high | 308 | title, raga and composer agree |
| attach | medium | 22 | title and raga agree; either we hold the song twice and the fuller copy was chosen, or one side has no composer |
| review | medium | 22 | title and raga agree, composer differs. Mostly the same song with the composer spelled very differently (`Tiruvotriyur Thyagaiyer` and `TiruveTTiyoor Tyaagayya`) |
| review | low | 37 | title agrees, raga differs. Many are one raga under two names (Dwijavanthi and jujAvanti); some are karnatik.com errors (Malahari geethams stored as Bilahari); some are different songs |
| create | high | 29 | no title of ours agrees |

Two Enna Thavam lessons point at the same record of ours. Only the first is attached; the
CSV step warns about the second.

## How to review

1. In the CSV, write `attach`, `create` or `skip` in `decision`. A spreadsheet fill-down
   from `suggestion` works for the attach rows.
2. For a `review` row that is the same song, write `attach`. If another record fits better,
   put its id in `match_id` (`other_ids` lists the runners-up).
3. For a `create` row, check `new_raga`, `new_tala`, `new_composer` and `new_language`. They
   hold our existing spellings where one was found. A composer that is not ours yet becomes
   a new artist. Six creates have no `new_language`; fill it in, or the row is refused.

## Commands after review

```sh
cd packages/scripts
pnpm prod-cli source-csv --source shivkumar \
  --file ../../docs/research/shivkumar-matches-2026-10.csv \
  --out ../../data/sources/shivkumar/import.csv
pnpm prod-cli source-apply --source shivkumar \
  --file ../../data/sources/shivkumar/import.csv --user <admin id> --dry-run
pnpm prod-cli source-apply --source shivkumar \
  --file ../../data/sources/shivkumar/import.csv --user <admin id>
pnpm prod-cli reindex
pnpm prod-cli seed:content   # the attribution page now credits shivkumar.org
```

`source-apply` writes `import.csv.applied-<time>.json` beside the CSV. Keep it: it is what
undo reads. To take back one song, or all of it:

```sh
pnpm prod-cli source-undo --manifest <that file> --only <composition id> --dry-run
pnpm prod-cli source-undo --manifest <that file> --only <composition id>
pnpm prod-cli source-undo --manifest <that file>     # the whole import
pnpm prod-cli reindex
```

`source-csv` needs `data/sources/shivkumar/lessons.json`. If it is missing, run
`npx tsx src/cli.ts source-fetch --source shivkumar` first; it needs poppler's `pdftotext`.
A trial with every suggestion accepted built 352 rows. `source-apply --dry-run` planned 329
attaches and 23 creates, with no new artist, raga or tala.

New compositions carry his lyrics, lowercased. They are not ITRANS, so run the respelling
readers over them afterwards (CLAUDE.md, "Respelling lyrics").

Signed-out pages are now cached at CloudFront, so an updated composition page can lag behind
by its cache lifetime.
