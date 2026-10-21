# STATE

Open items only, newest first. History moved to `docs/plans/state-archive-2026-10.md` on
2026-10-21; runbooks live in `docs/research/`.

## Done 2026-10-21: tala, lyrics and content cleanup in prod

Talas 75 → 20 (record: `docs/research/tala-cleanup-2026-10.csv.applied.json`); 145 compositions
cleaned of scraped navigation, ashtapadi indexes and karnatik.com headers, with the 34 refused
bhajan sections respelled (`data/lyrics-junk/`); 74 English lines moved to `meaning` in 12
compositions; 14 duplicate content pages deleted; search reindexed (12,494 documents). Reader notes
worth a look (kept close to the source where unsure): Ambe Gauri aarti lines 2–4 follow the
standard aarti text; `jaya jaya narasimha` line 1 is Malayalam and a Panini line was guessed;
`nandAtmajAnanda`, `sAvaLE sundar` and `gurumUrti pAdamulE` hold guessed readings.

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
