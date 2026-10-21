# STATE

Open items only, newest first. History moved to `docs/plans/state-archive-2026-10.md` on
2026-10-21; runbooks live in `docs/research/`.

## Next: run the prepared prod writes (2026-10-21)

Built, dry-run and reviewed; the session could not write to prod. Run from `packages/scripts`, in
this order, then reindex once:

1. `pnpm prod-cli tala-cleanup --apply --file ../../docs/research/tala-cleanup-2026-10.csv`
   (75 talas: 10 merged, 5 split, 40 unlinked, 82 compositions; record written beside the CSV).
2. `pnpm prod-cli admin-csv-import --domain composition --file ../../data/lyrics-junk/lyrics-cleanup-import.csv --user 39WZZXug7V6PdinExzhhp6zDuKD --dry-run`,
   then without `--dry-run`. Scraped navigation, ashtapadi indexes and karnatik.com headers
   (report: `data/lyrics-junk/report.csv`), plus the 34 refused bhajan sections respelled.
3. Only after 2: `pnpm prod-cli lyrics-meanings --apply --file ../../data/lyrics-meanings.csv --out ../../data/lyrics-meanings-import.csv`,
   then `admin-csv-import` that file (dry run first). 121 English lines; decisions reviewed.
4. `pnpm prod-cli seed:content --prune` (deletes the 14 March copies of the static pages).
5. `pnpm prod-cli reindex`.

## Waiting on the owner's review

- **Raga dedupe:** `docs/research/raga-dedupe-2026-10.csv` (67 suggested merges). Write `merge` in
  `decision`, then the commands in `docs/research/raga-dedupe-2026-10.md`: dry run, apply,
  reindex, `generate-melakarta-links`, commit the map, deploy. Also settle the two melakartas
  stored twice under different words (`tODi`/`hanumatODi`, `kAmavardhani`/`kAshIrAmakriya`) and
  the 184 janyas pointing at a merged-away parent; see the archive.
- **Lyrics respelling review:** five word swaps (`vArAmE`, `nAvalar`, `maDam`, `jAnAmitE`,
  `kamsAdi`) and `docs/research/lyrics-respelling-w10-review.md`.
- **carnatic-circle.com held rows:** blank `decision` in
  `docs/research/carnatic-circle-matches-2026-10.csv` (16 from the bhajan pass, ~60 title matches
  whose lyrics disagree). Then `source-csv`, `source-apply`, reindex. Raga scale disagreements:
  `docs/research/carnatic-circle-raga-report-2026-10.csv`.

## Open, needs a person

- **Records holding another song.** `data/lyrics-junk/report.csv` rows marked `other-song` (7)
  carry a karnatik.com header naming a different title; `ra~Ngamma mAjhI` holds a second song
  after "Some Variations to the above song". Split or retitle by hand.
- **Lyrics damage still stored:** 33 compositions with `�`; languages outside
  `LYRICS_LANGUAGES` (Sourashtra, Gujarati, Braj); a few karuNa ceyvAn entu / vanajAkSa notes.
- **Wrong cast roles on events:** Neyveli Venkatesh credited `vocal`, Shashank `tabla` on the
  `EventArtist` rows; fix in the event edit screen.
- **Artist records that are not people:** "Karnataka Kalashri", "Disciples of Mowna
  Ramachandra"; possible duplicate Bangalore Arjun Kumar / Arjun Kumar.
- **Stored scale damage:** `varies`, `M3`, `PN3`, subscript digits in a few raga scales
  (`research-ingest` prints them).
- **GA4 bot filter:** only in the GA4 UI; see the archive.

## Done, not yet verified after deploy

- **Artist profile redesign** is live. Never confirmed: the backfills (`rebuild-repertoire`,
  `rebuild-featured`, `rebuild-collaborators`), `ArtistDenormRebuildCron` duration and memory,
  and junction rows with malformed `gsi1sk` (scan for values not starting `$eventartist_`).
  The deferred review items are in the archive.
- **Rasika Classes** is live at classes.rasika.life. No Google console change is needed: Google
  only redirects to `auth.rasika.life`, and the issuer already allows any `*.rasika.life`
  callback. Still untested: sign-in from the installed iPhone icon.
