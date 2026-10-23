# Listing features from the Kalaverse review (2026-10-23)

Six features taken from a review of kalaverse.com, plus one bug found on the way. Ordered so
each phase ships on its own.

## What prod holds today (read 2026-10-23)

These numbers shape the plan more than the features do.

| Fact | Value | Consequence |
|---|---|---|
| Upcoming approved events | 23 | Filtering in memory is free. Load them all, not the first 100. |
| Upcoming events with `venueCity` | 1 of 23 | A city filter cannot read `event.venueCity`. Resolve the city from the venue. |
| Venues with `address.city` | 74 of 145 (67 Bengaluru) | City pages work for Bengaluru now. |
| Venues with `mapLink` | 9 (mostly `maps.app.goo.gl` short links) | Few exact coordinates. |
| Venues with `address.postalCode` | 56 | A PIN centroid is the main source of venue coordinates. |
| Verified artists (`claimStatus = verified`) | 0 of 1,401 | The "Verified" filter shows only when at least one exists. |
| Bytes per stored event | ~5.3 KB | Project listing attributes; `extractionRawResponse` rides along otherwise. |

## Phase 0: event times render in UTC (bug)

`EventCard` and `EventDayGroup` call `toLocaleTimeString` with no zone. The SSR Lambda runs in
UTC, so rasika.life/events printed "12:30 pm" for a 6:00 pm IST concert, and grouped by
`startDateTime.slice(0, 10)`, which is wrong for a UTC-stored row. Fix: format and group in the
event's own `timezone` (`formatEventTime`, `eventDateKey` in `~/lib/event-time.ts`). The festival
programme has the same bug.

## Phase 1: date presets, month calendar, "Free only" on /events

- Core: `listAllUpcomingEvents()` pages through `byStatus` and projects listing attributes only.
- `~/lib/event-filters.ts` (pure, tested): `resolveDateRange(when, today)` for `today`,
  `weekend`, `week`, a month (`2026-11`) or one day (`2026-11-14`), always in the event zone
  (`DEFAULT_EVENT_TIMEZONE`), never UTC. `filterEvents(events, {range, free, city})`.
  `dayCounts(events)` for the calendar.
- Weekend is Saturday and Sunday of this week; on a Sunday it is today only. Week is today
  through Sunday.
- "Free only" means `entryType === 'free'`. A missing value is unknown, not free.
- All filters are query parameters, so the page stays server-rendered, works without
  JavaScript, and caches per URL (the CloudFront policy keys on all query strings).
- **Date-relative pages expire at midnight in India.** A page cached for a week would still
  list Monday's concerts on Tuesday. `cacheUntilMidnight(now, zone)` sets `s-maxage` to the
  seconds left in the day. Used by /events and every city page.

## Phase 2: WhatsApp digest

A "WhatsApp" view beside the list (`?view=whatsapp`). `formatWhatsAppDigest` (pure, tested)
builds plain text grouped by day: the performers (or the title when it says more), each
accompanist with an instrument, venue, time, Free/Ticketed, and a closing link to the same
filtered listing on rasika.life. Options are query parameters: `cast=0` drops accompanists,
`links=1` adds a link per event. Copy uses the clipboard; "Open in WhatsApp" is a plain `wa.me`
link, so it works without JavaScript. Long lists stop at 30 events, then "and N more" plus the
link. The festival page gets the same digest of its programme.

## Phase 3: city landing pages

`/<city>/concerts`, `/<city>/concerts/today`, `/this-weekend`, `/this-week`. Server-rendered,
`ItemList` JSON-LD, a meta description that names the count and the next concert. A city is a
slug of a stored venue city. `bangalore`, `madras` and `mysore` redirect (301) to the stored
spelling. An unknown city returns 404. An empty range still renders and lists the next
concerts, so the page is never thin. The `/<city>/concerts` pages go in the static sitemap for
every city with an upcoming concert.

The event's city comes from its venue (`venue.address.city`), then `event.venueCity`. Nothing
is written back to the event.

## Phase 4: artists "Popular" sort and "Verified" filter

The search indexer already loads every artist and every approved event. It now puts two derived
fields on each artist document:

- `popularity` = credited approved events + Σ `rsvpCount` + Σ `attendedCount` on those events
  (`artistPopularity`, pure, tested). Derived, never typed, refreshed every 6 hours with the
  index.
- `verified` = `claimStatus === 'verified'`.

`artist.browse({ sort, verified, page })` ranks the documents, then batch-gets the page's
artists. `/artists?sort=popular` and `/artists?verified=1` use it; the default A–Z listing is
unchanged. The Verified chip renders only when `verifiedCount > 0`.

## Phase 5: distance from your PIN code

- Venue gets optional `lat`, `lng` and `geoSource` (`map-link` | `postal-code` | `manual`), and
  the admin CSV gets the three columns.
- `pnpm cli geocode-venues [--apply]`: dry run by default; fills only empty coordinates. From a
  `mapLink` first (short links are followed to the full URL, then `@lat,lng`, `!3d…!4d…` or
  `q=lat,lng` is read), else from the PIN centroid table. Parsing is in
  `domain/venue/geo.ts`, tested.
- PIN centroids: `pnpm cli pin-centroids` queries Nominatim (OpenStreetMap, 1 request a second)
  for the PIN ranges we cover and writes `packages/web/public/pin-centroids.json`, committed.
  GeoNames was tried first and rejected: it puts 560003 (Malleswaram) at the district centroid,
  about 25 km out.
- On the page: the loader sends each event's venue coordinates. The reader types a PIN or taps
  "Use my location"; the browser computes the straight-line distance and shows "≈ 6 km". The PIN
  lives in `localStorage`, never a cookie, so the cached page stays one copy for everyone.

## Not doing

- Venue claims (held, per the artist redesign PRD).
- Writing `venueCity` back onto events, or coordinates onto prod venues, without the owner's
  go-ahead. Both scripts are dry by default.

## Status (2026-10-23)

All five phases built, tests green, not deployed. Venue geocoding applied to prod: 53 of 145
venues (6 from a map link, 47 from a PIN). The venues most upcoming events point at are
name-only duplicates, so their merges (`docs/research/venue-merge-2026-10-23.csv`) are what
gives those concerts a city and a distance.
