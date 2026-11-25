# Raga description experiment, 2026-11

Question: do raga pages get more clicks if the description says what the page offers, not the
full arohanam and avarohanam?

Why: raga detail pages earned 37,892 impressions at 1.6% CTR and position 6.7 (Search Console,
12 to 24 Nov 2026). The old description prints both scales, which may answer the search
without a click.

## What changed

For the 10 ragas below, `ragaMetaDescription` (`packages/web/app/lib/raga-description.ts`)
uses `offerLedDescription`. It leads with the composition count (with composer and tala), the
logged concert performances, and the janya or melakarta parent. It does not print the scale.
It claims no lyrics or audio: the raga page lists compositions and links to them, it does not
play or print them. A raga on the list with no compositions and no performances keeps the old
text. Titles are unchanged. Every other raga is unchanged.

Example: "Kapi raga: 52 compositions with composer and tala and 14 logged concert
performances. Janya raga of Kharaharapriya (melakarta 22)." (numbers here are illustrative)

The list is `OFFER_LED_RAGA_IDS` in the same file.

| Raga | ID | Impressions | Clicks |
|---|---|---|---|
| abheri | 38b95hjF0MrS1NiTJc43IJTc4Wx | 849 | 6 |
| hamsanandi | 38b8ZSteuPUHAfLNwVLbmiQe9jV | 716 | 7 |
| kapi | 38avAHevxOrTy4Ne8Xn8VtlE1VK | 687 | 5 (old URL, `k%C4%81pi-...`) |
| navarasa-kannada | 38avqwbuO5TSYDh765Ek6uVL0nF | 658 | 3 |
| kanada | 38aw2E5kSMPYdIaV8p0cRM3fdvU | 546 | 4 |
| khamas | 38avAQo2fDS0XmavGK7hBjwPyqq | 478 | 4 |
| kalyani | 38avRxJjxIoOjNeaorNfJDJFWRm | 445 | 1 |
| bhairavi | 38avUziLkV5coHIV2RKJ2Dm8zez | 436 | 4 |
| hindola | 38avPvf9YEzoHnQjtHLjDx9OeJp | 432 | 3 |
| kharaharapriya | 38avMmk0wVmOsfNCaSkx6hnjI4f | 354 | 2 |

Baseline is 12 to 24 Nov 2026 (13 days). Total: 5,601 impressions, 39 clicks, 0.7% CTR.

## Timeline

- Start: the day the commit deploys (planned 2026-11-26; confirm from the Deploy run date).
- Check: 2026-12-24, 13 days of data on the same days of the week as the baseline, using the
  same window length (11 to 24 Dec). Compare each page's CTR and position with the baseline.
  Query the page by its 27-character ID, because the old-slug redirect also ships in this
  change and moves impressions from the old `k%C4%81pi` URL to the canonical one.

## Cautions

- The December season raises searches for everything. Compare against the other ragas over
  the same two windows (all raga pages' CTR), not only against the baseline.
- Google re-reads descriptions slowly and may write its own snippet. Look at position as well
  as CTR.
- 13 days and about 5,600 impressions is a small sample. A change under 1 point of CTR is noise.
- After the check, keep the text and extend it, or remove `OFFER_LED_RAGA_IDS` and
  `offerLedDescription`.
