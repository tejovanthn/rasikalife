# STATE

Open items only, newest first. History moved to `docs/plans/state-archive-2026-10.md` on
2026-10-21; runbooks live in `docs/research/`.

## 2026-10-24: venue addresses from posters, applied to prod

68 venues got address parts read off their own event posters
(`docs/research/venue-addresses-2026-10.csv`, one row per venue with the poster text), then
2 `venueType` fills, 35 PIN-centroid points, reindex. Prod now: city 126/150, PIN 92, coords 88.
Open, each needing a person's call:
- Merge: Ramanamaharshi Auditorium → Ramana Maharshi Heritage Auditorium; SRLKM Concert Hall ↔
  Sri Rama Lalitha Kala Mandir Hall; the two "Lecture Theatre 1" (St. John's). Check: Sri Vani
  Vidya Kendra / Sri Vanikala Kendra, MLR Convention / Cultural Centre, the two Mudaliar Sangam
  halls, the two Aksharam rows. Plus the pending rows in `venue-merge-2026-10-23.csv`.
- Do not merge: Bhairavi Sabha (Puducherry) into Indiranagar Sangeetha Sabha; the Shankarapura
  and JP Nagar Sringeri Maths. `dedup-places` proposes both.
- Re-point events: the Chennai concerts on Geri Care and Hamsadhwani (Bengaluru records);
  Samanwaya Dance Academy's event (poster says ADA Rangamandira); the events at JSS Chintana
  Mantapa, Bhagavatha Keerthi Dhama and Indian Heritage Academy Hall carry a shared schedule
  screenshot as their poster.
Next step: mark the merges in a `dedup-places` CSV and dry-run it.

Deployed 2026-10-24: approval now copies a poster's printed address onto a venue that has
none (`event.venueAddress`, verify-page address block, `cascadeEventAddressToVenue`). Not
tried with a real poster yet. Deferred: a weekly Gemini pass over older venues' posters
that writes a review list, not the record; build it only if venues still arrive empty.

## 2026-10-23: listing features (Kalaverse review), deployed 2026-10-24

Built: event times in the event zone with a zone label; /events with date pages
(`/events/today`, `/this-weekend`, `/this-week`), month calendar and "Free only";
`/<city>/concerts`; WhatsApp text with UTM tags; "≈ km away" for signed-in readers with a saved
location; artists Popular/Verified; accompanists on cards; "Listen on"; directions; sign-in now
returns to the page that asked. Plan: `docs/plans/261023-01-listing-features.md`.
In prod already: 53 of 145 venues geocoded (`geocode-venues --apply`, 6 map link, 47 PIN).

Live check 2026-10-24: all listing pages return 200 with Brotli, `/bangalore/concerts` 301s to
`/bengaluru/concerts`, the city list and the Popular sort already read the new index fields.
Next step: mark `whatsapp_digest` a key event in GA4, then check the new rows on a phone.

## Backlog (listing features)

- Artist and venue event lists grouped by month, with "show more months".
- Home page "Carnatic today" section from the upcoming listing.
- Follow artists and venues. Needs a delivery channel (an email digest) before it means anything.
- Venue "what's on" 14-day strip, once venues hold more than a few events.
- City naming: people search "bangalore" (260/month), not "bengaluru" (0); consider titling the
  city page "Bangalore" or making `/bangalore/concerts` canonical.
- A pre-built listing snapshot (S3, rebuilt on approval) once upcoming events pass ~1,000.

## Done 2026-10-21: tala, lyrics and content cleanup in prod

Talas 75 → 20 (record: `docs/research/tala-cleanup-2026-10.csv.applied.json`); 145 compositions
cleaned of scraped navigation, ashtapadi indexes and karnatik.com headers, with the 34 refused
bhajan sections respelled (`data/lyrics-junk/`); 74 English lines moved to `meaning` in 12
compositions; 14 duplicate content pages deleted; search reindexed (12,494 documents). Reader notes
worth a look (kept close to the source where unsure): Ambe Gauri aarti lines 2–4 follow the
standard aarti text; `jaya jaya narasimha` line 1 is Malayalam and a Panini line was guessed;
`nandAtmajAnanda`, `sAvaLE sundar` and `gurumUrti pAdamulE` hold guessed readings.

## Waiting on the owner's review

- **Venue merges that unlock the city pages:** `docs/research/venue-merge-2026-10-23.csv`. The
  venues 16 of 23 upcoming events use are name-only duplicates (The Gayana Samaja, a bare PCPA),
  so those concerts show no city or distance. Write `merge` in `decision`, then
  `pnpm prod-cli dedup-places --apply --file <csv> --dry-run`, then without `--dry-run`, reindex.
  The PCPA row is deliberately reversed from the report's suggestion: `mergeVenue` copies no
  fields, and the report would have kept the record without an address.
- **MLR Convention Centre** (venue `3KHmLJubyhp3S7RrEWyRd5pylsp`, 30 Oct concert) has no address.
  Brigade runs two (JP Nagar 7th Phase 560078, and Whitefield); confirm which before filling it.

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

- **Talapettige** is live at talapettige.rasika.life (2026-10-22). Headers checked. Still
  untested on a real phone: install from the browser, then airplane mode, reopen and press Play.
- **Artist profile redesign** is live. Never confirmed: the backfills (`rebuild-repertoire`,
  `rebuild-featured`, `rebuild-collaborators`), `ArtistDenormRebuildCron` duration and memory,
  and junction rows with malformed `gsi1sk` (scan for values not starting `$eventartist_`).
  The deferred review items are in the archive.
- **Rasika Classes** is live at classes.rasika.life. No Google console change is needed: Google
  only redirects to `auth.rasika.life`, and the issuer already allows any `*.rasika.life`
  callback. Still untested: sign-in from the installed iPhone icon.
