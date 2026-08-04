/**
 * Matching keys for finding the same raga stored twice.
 *
 * The corpus carries two import generations, and the same raga appears in both
 * under different spellings — `aabheri` beside `abheri`, `hamirkalyani` beside
 * `hamir-kalyani`, `kalyANi` beside `kalyani (meca kalyani, shantakalyani)`.
 * Around 312 of 1,869 raga pages are a second copy of one already on the site.
 *
 * Two keys, because the two carry very different confidence. `ragaExactKey` only
 * removes what is certainly noise — case, diacritics, punctuation, the alias
 * bracket — so a collision is a real duplicate. `ragaVariantKey` guesses at
 * transliteration spelling and will occasionally collide two genuinely different
 * ragas, so nothing it matches may be merged without a person looking.
 */

/** Case, diacritics, punctuation and alias brackets removed. A collision here is real. */
export function ragaExactKey(name: string): string {
  return name
    .replace(/\s*\(.*?\)\s*/g, ' ')
    .normalize('NFKD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '');
}

/**
 * Collapses the ways one raga gets spelled: doubled vowels marking length
 * (`bahudaari`/`bahudari`), c/k, sh/s, w/v, and a trailing -m or -am.
 *
 * Lossy on purpose, and it does collide distinct ragas — which is why the dedup
 * CLI reports variant matches for review rather than applying them.
 */
export function ragaVariantKey(name: string): string {
  let key = ragaExactKey(name);
  key = key.replace(/(.)\1+/g, '$1');
  key = key.replace(/ee/g, 'i').replace(/oo/g, 'u').replace(/aa/g, 'a');
  key = key.replace(/kh/g, 'k').replace(/sh/g, 's').replace(/c/g, 'k').replace(/w/g, 'v');
  // `hindolam` and `hindola` are one raga written two ways, so the ending has to
  // go entirely rather than just its -am form.
  key = key.replace(/(am|m|a)$/, '');
  return key;
}
