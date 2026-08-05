import { describe, expect, it } from 'vitest';
import { serializeJsonLd } from './json-ld';
import {
  artistJsonLd,
  definedTermJsonLd,
  eventJsonLd,
  eventListItems,
  festivalJsonLd,
  festivalLocationName,
  itemListJsonLd,
  musicCompositionJsonLd,
  organisationSchemaType,
  organiserJsonLd,
  postalAddress,
  venueJsonLd,
  venueSchemaType,
} from './structured-data';

/**
 * Round-trip through the serialiser the components use, so every assertion below is about what
 * a crawler actually receives rather than about the object we happened to build. This is what
 * catches an `undefined` inside an array, which survives in memory and arrives as `null`.
 */
function emitted(payload: unknown): Record<string, unknown> {
  return JSON.parse(serializeJsonLd(payload));
}

describe('postalAddress', () => {
  it('drops an address with nothing in it rather than emitting an empty PostalAddress', () => {
    expect(postalAddress(undefined)).toBeUndefined();
    expect(postalAddress({})).toBeUndefined();
    expect(postalAddress({ city: '   ' })).toBeUndefined();
  });

  it('maps the stored parts onto the schema.org names', () => {
    expect(postalAddress({ street: '16th Cross', city: 'Bengaluru', state: 'Karnataka' })).toEqual({
      '@type': 'PostalAddress',
      streetAddress: '16th Cross',
      addressLocality: 'Bengaluru',
      addressRegion: 'Karnataka',
    });
  });
});

describe('venueSchemaType', () => {
  it('claims a business type only for the two kinds that trade as one', () => {
    expect(venueSchemaType('auditorium')).toBe('PerformingArtsTheater');
    expect(venueSchemaType('sabha-hall')).toBe('PerformingArtsTheater');
  });

  // A temple hall belongs to the temple, a terrace to whoever lives there. Neither is a
  // business with this address and phone number, which is what LocalBusiness asserts.
  it('leaves every other kind a plain Place, including "other" and unset', () => {
    for (const type of ['temple-hall', 'open-air', 'pandal', 'terrace', 'university', 'other']) {
      expect(venueSchemaType(type)).toBe('Place');
    }
    expect(venueSchemaType(null)).toBe('Place');
    expect(venueSchemaType(undefined)).toBe('Place');
  });
});

describe('organisationSchemaType', () => {
  it('reads only the two types with an exact schema.org counterpart', () => {
    expect(organisationSchemaType('ngo')).toBe('NGO');
    expect(organisationSchemaType('university')).toBe('CollegeOrUniversity');
  });

  // HinduTemple is a PlaceOfWorship — a building. This record is the body that programmes the
  // concerts, and a trust has no schema.org type that does not assert a different registration.
  it('does not promote a sabha, trust or temple to a type that asserts more', () => {
    for (const type of ['sabha', 'trust', 'temple', 'other']) {
      expect(organisationSchemaType(type)).toBe('Organization');
    }
    expect(organisationSchemaType(undefined)).toBe('Organization');
  });
});

describe('artistJsonLd', () => {
  const base = { name: 'T M Krishna', url: 'https://rasika.life/artists/t-m-krishna-abc' };

  it('says nothing at all about a record that holds nothing', () => {
    const out = emitted(artistJsonLd(base, false));
    expect(out['@type']).toBe('Person');
    expect(out.name).toBe('T M Krishna');
    // The blanket "Renowned classical musician" and the constant knowsAbout are the two claims
    // this page used to make of all 1,111 artists.
    expect(out).not.toHaveProperty('description');
    expect(out).not.toHaveProperty('knowsAbout');
    expect(out).not.toHaveProperty('award');
    expect(out).not.toHaveProperty('sameAs');
    expect(out).not.toHaveProperty('address');
  });

  it('carries the tradition-free facts the record does hold', () => {
    const out = emitted(
      artistJsonLd(
        {
          ...base,
          description: 'T M Krishna — Vocal · Chennai.',
          instruments: ['Vocal'],
          specialisations: ['Ragam tanam pallavi'],
          city: 'Chennai',
          awards: ['Sangita Kalanidhi'],
          sameAs: ['https://example.com/tmk'],
        },
        false
      )
    );
    expect(out.knowsAbout).toEqual(['Vocal', 'Ragam tanam pallavi']);
    expect(out.address).toEqual({ '@type': 'PostalAddress', addressLocality: 'Chennai' });
    expect(out.award).toEqual(['Sangita Kalanidhi']);
  });

  it('renders a group as a MusicGroup with members, and never as a Person', () => {
    const out = emitted(
      artistJsonLd(
        {
          ...base,
          name: 'Priya Sisters',
          members: [{ name: 'Shanmukhapriya', url: 'https://rasika.life/artists/a-1' }],
          memberOf: [{ name: 'Ignored', url: 'https://rasika.life/artists/a-2' }],
        },
        true
      )
    );
    expect(out['@type']).toBe('MusicGroup');
    expect(out.member).toEqual([
      { '@type': 'Person', name: 'Shanmukhapriya', url: 'https://rasika.life/artists/a-1' },
    ]);
    // memberOf, affiliation and alumniOf belong to the individual's shape.
    expect(out).not.toHaveProperty('memberOf');
  });

  // Collapsing these would tell a crawler that everyone with a diploma works for the awarding
  // university.
  it('keeps an affiliation apart from where a qualification came from', () => {
    const out = emitted(
      artistJsonLd(
        {
          ...base,
          affiliations: [{ name: 'Kalakshetra', url: 'https://rasika.life/organisers/k-1' }],
          alumniOf: ['Madras University'],
        },
        false
      )
    );
    expect(out.affiliation).toEqual([
      { '@type': 'Organization', name: 'Kalakshetra', url: 'https://rasika.life/organisers/k-1' },
    ]);
    expect(out.alumniOf).toEqual([
      { '@type': 'EducationalOrganization', name: 'Madras University' },
    ]);
  });
});

describe('definedTermJsonLd', () => {
  const set = { setName: 'Carnatic ragas', setUrl: 'https://rasika.life/carnatic/ragas' };

  it('numbers a melakarta and leaves a janya raga unnumbered', () => {
    const melakarta = emitted(
      definedTermJsonLd({ name: 'Kalyani', url: 'https://x/1', termCode: 65, ...set })
    );
    expect(melakarta.termCode).toBe('65');

    // A janya raga stores its parent's mela number. Emitting it here would number Abheri
    // among the 72, which is the claim the meta description had to be fixed for.
    const janya = emitted(
      definedTermJsonLd({ name: 'Abheri', url: 'https://x/2', termCode: null, ...set })
    );
    expect(janya).not.toHaveProperty('termCode');
  });

  it('is a DefinedTerm, not a CreativeWork, so nothing asks it for a composer', () => {
    const out = emitted(definedTermJsonLd({ name: 'Adi', url: 'https://x/3', ...set }));
    expect(out['@type']).toBe('DefinedTerm');
    expect(out.inDefinedTermSet).toEqual({
      '@type': 'DefinedTermSet',
      name: 'Carnatic ragas',
      url: 'https://rasika.life/carnatic/ragas',
    });
  });
});

describe('musicCompositionJsonLd', () => {
  const composition = {
    title: 'Vatapi Ganapatim',
    url: 'https://rasika.life/carnatic/compositions/vatapi-1',
    composer: { name: 'Muthuswami Dikshitar', url: 'https://rasika.life/artists/md-1' },
    ragas: [{ name: 'Hamsadhwani', url: 'https://rasika.life/carnatic/ragas/hamsadhwani-1' }],
    talas: [{ name: 'Adi', url: 'https://rasika.life/carnatic/talas/adi-1' }],
    language: 'Sanskrit',
  };

  // Both of these shipped for months: an album that exists nowhere, and a publication date
  // that was really the day the row was written here.
  it('invents neither an album nor a publication date', () => {
    const out = emitted(musicCompositionJsonLd(composition));
    expect(out).not.toHaveProperty('inAlbum');
    expect(out).not.toHaveProperty('datePublished');
  });

  it('points `about` at the raga and tala pages so the link is an edge, not a keyword', () => {
    const out = emitted(musicCompositionJsonLd(composition));
    expect(out.about).toEqual([
      {
        '@type': 'DefinedTerm',
        name: 'Hamsadhwani',
        url: 'https://rasika.life/carnatic/ragas/hamsadhwani-1',
      },
      { '@type': 'DefinedTerm', name: 'Adi', url: 'https://rasika.life/carnatic/talas/adi-1' },
    ]);
  });

  it('claims lyrics only when the record stores some', () => {
    expect(emitted(musicCompositionJsonLd(composition))).not.toHaveProperty('lyrics');
    const withLyrics = emitted(musicCompositionJsonLd({ ...composition, hasLyrics: true }));
    expect(withLyrics.lyrics).toMatchObject({ '@type': 'CreativeWork' });
  });
});

describe('eventJsonLd', () => {
  const event = {
    title: 'Margazhi Concert',
    url: 'https://rasika.life/events/margazhi-1',
    startDateTime: '2026-12-20T18:00:00+05:30',
  };

  // Google's Event rich result requires location.address. Shipping a Place with only a name
  // made every concert on the site ineligible.
  it('gives the location an address when the venue record has one', () => {
    const out = emitted(
      eventJsonLd({
        ...event,
        location: {
          name: 'Chowdiah Memorial Hall',
          url: 'https://rasika.life/venues/chowdiah-1',
          address: { street: 'Gayathri Devi Park Extension', city: 'Bengaluru' },
        },
      })
    );
    expect(out.location).toEqual({
      '@type': 'Place',
      name: 'Chowdiah Memorial Hall',
      url: 'https://rasika.life/venues/chowdiah-1',
      address: {
        '@type': 'PostalAddress',
        streetAddress: 'Gayathri Devi Park Extension',
        addressLocality: 'Bengaluru',
      },
    });
  });

  it('omits the location entirely rather than naming a place it cannot name', () => {
    expect(emitted(eventJsonLd(event))).not.toHaveProperty('location');
  });

  it('prices a free event at zero and says nothing about one sold by invitation', () => {
    expect(emitted(eventJsonLd({ ...event, entryType: 'free' })).offers).toEqual([
      {
        '@type': 'Offer',
        price: '0',
        priceCurrency: 'INR',
        availability: 'https://schema.org/InStock',
      },
    ]);

    // A ticketed event with no prices filled in must not fall through to a zero offer, which
    // would put "Free" beside it in a search result.
    const invited = emitted(eventJsonLd({ ...event, entryType: 'by-invitation' }));
    expect(invited).not.toHaveProperty('offers');
    expect(invited).not.toHaveProperty('isAccessibleForFree');

    const ticketed = emitted(
      eventJsonLd({
        ...event,
        entryType: 'ticketed',
        ticketing: { url: 'https://tickets.example/x', prices: { premium: 500, regular: 200 } },
      })
    );
    expect(ticketed.offers).toHaveLength(2);
  });

  it('links each performer to their profile, and drops a row with no name', () => {
    const out = emitted(
      eventJsonLd({
        ...event,
        artists: [
          { name: 'Sanjay Subrahmanyan', url: 'https://rasika.life/artists/ss-1' },
          { name: '  ' },
        ],
      })
    );
    expect(out.performer).toEqual([
      { '@type': 'Person', name: 'Sanjay Subrahmanyan', url: 'https://rasika.life/artists/ss-1' },
    ]);
  });

  it('names the festival a concert belongs to as its superEvent', () => {
    const out = emitted(
      eventJsonLd({
        ...event,
        partOf: { name: 'Margazhi 2026', url: 'https://rasika.life/festivals/m-1' },
      })
    );
    expect(out.superEvent).toEqual({
      '@type': 'Festival',
      name: 'Margazhi 2026',
      url: 'https://rasika.life/festivals/m-1',
    });
  });
});

describe('festivalLocationName', () => {
  it('names the hall only when every concert agrees on it', () => {
    expect(
      festivalLocationName([{ venueName: 'Gayana Samaja' }, { venueName: 'Gayana Samaja' }])
    ).toBe('Gayana Samaja');
    // A city-wide festival has no one venue, and naming the first would put the wrong hall in
    // a search result.
    expect(
      festivalLocationName([{ venueName: 'Gayana Samaja' }, { venueName: 'Chowdiah' }])
    ).toBeUndefined();
    expect(festivalLocationName([])).toBeUndefined();
    expect(festivalLocationName([{ venueName: null }])).toBeUndefined();
  });
});

describe('festivalJsonLd', () => {
  it('lists its concerts as subEvents', () => {
    const out = emitted(
      festivalJsonLd({
        name: 'Margazhi 2026',
        url: 'https://rasika.life/festivals/m-1',
        startDate: '2026-12-15',
        endDate: '2027-01-01',
        events: [
          {
            title: 'Opening concert',
            url: 'https://rasika.life/events/e-1',
            startDateTime: '2026-12-15T18:00:00+05:30',
            venueName: 'Music Academy',
          },
        ],
      })
    );
    expect(out['@type']).toBe('Festival');
    expect(out.subEvent).toHaveLength(1);
    expect(out.location).toEqual({ '@type': 'Place', name: 'Music Academy' });
  });

  it('has no subEvent key at all when no concert is listed', () => {
    const out = emitted(festivalJsonLd({ name: 'F', url: 'https://x/f', startDate: '2026-12-15' }));
    expect(out).not.toHaveProperty('subEvent');
    expect(out).not.toHaveProperty('location');
  });
});

describe('venueJsonLd', () => {
  const venue = {
    id: 'v1',
    name: 'Chowdiah Memorial Hall',
    url: 'https://rasika.life/venues/chowdiah-v1',
    venueType: 'auditorium',
    address: { street: 'Gayathri Devi Park Extension', city: 'Bengaluru' },
  };

  it('states the address once and has every event point back at it', () => {
    const out = emitted(
      venueJsonLd({
        ...venue,
        events: [
          {
            title: 'Concert',
            url: 'https://rasika.life/events/e-1',
            startDateTime: '2026-09-01T18:00:00+05:30',
          },
        ],
      })
    );
    expect(out['@id']).toBe('https://rasika.life/venues/chowdiah-v1#venue');
    expect((out.event as Array<{ location: unknown }>)[0].location).toEqual({
      '@id': 'https://rasika.life/venues/chowdiah-v1#venue',
    });
  });

  it('turns stored amenity slugs into machine-readable features', () => {
    const out = emitted(venueJsonLd({ ...venue, amenities: ['wheelchair-accessible', 'parking'] }));
    expect(out.amenityFeature).toEqual([
      { '@type': 'LocationFeatureSpecification', name: 'wheelchair accessible', value: true },
      { '@type': 'LocationFeatureSpecification', name: 'parking', value: true },
    ]);
  });

  // email is an Organization property. A PerformingArtsTheater is one; a plain Place is not,
  // and a validator flags it.
  it('carries an email only on a type that may hold one', () => {
    expect(emitted(venueJsonLd({ ...venue, email: 'hall@example.com' })).email).toBe(
      'hall@example.com'
    );
    const templeHall = emitted(
      venueJsonLd({ ...venue, venueType: 'temple-hall', email: 'hall@example.com' })
    );
    expect(templeHall['@type']).toBe('Place');
    expect(templeHall).not.toHaveProperty('email');
  });

  it('gathers the website and every social link into sameAs', () => {
    const out = emitted(
      venueJsonLd({
        ...venue,
        website: 'https://chowdiahmemorialhall.com',
        socialLinks: [{ url: 'https://instagram.com/chowdiah' }],
      })
    );
    expect(out.sameAs).toEqual([
      'https://chowdiahmemorialhall.com',
      'https://instagram.com/chowdiah',
    ]);
  });
});

describe('organiserJsonLd', () => {
  const organiser = {
    id: 'o1',
    name: 'Bangalore Gayana Samaja',
    url: 'https://rasika.life/organisers/gayana-samaja-o1',
  };

  it('falls back to the bare city when there is no full address', () => {
    const out = emitted(organiserJsonLd({ ...organiser, city: 'Bengaluru' }));
    expect(out.address).toEqual({ '@type': 'PostalAddress', addressLocality: 'Bengaluru' });
  });

  // A year is valid ISO 8601 and a year is all the record holds; padding it to 1 January
  // would invent a founding day.
  it('publishes a founding year as a year', () => {
    expect(emitted(organiserJsonLd({ ...organiser, foundedYear: 1905 })).foundingDate).toBe('1905');
    expect(emitted(organiserJsonLd(organiser))).not.toHaveProperty('foundingDate');
  });

  it('reads the organisation type through to the schema type', () => {
    expect(emitted(organiserJsonLd({ ...organiser, organisationType: 'ngo' }))['@type']).toBe(
      'NGO'
    );
    expect(emitted(organiserJsonLd({ ...organiser, organisationType: 'sabha' }))['@type']).toBe(
      'Organization'
    );
  });
});

describe('eventListItems', () => {
  const rows = [
    {
      id: 'e1',
      title: 'Concert one',
      startDateTime: '2026-09-01T18:00:00+05:30',
      venueName: 'Gayana Samaja',
    },
    { id: 'e2', title: 'Concert two', startDateTime: '2026-09-02T18:00:00+05:30' },
  ];
  const url = (title: string, id: string) => `/events/${title.replace(/\s+/g, '-')}-${id}`;

  it('builds one absolute-URL event per row, keeping the listing order', () => {
    const items = eventListItems(rows, url);
    expect(items).toHaveLength(2);
    expect(items[0]).toMatchObject({
      '@type': 'MusicEvent',
      name: 'Concert one',
      url: 'https://rasika.life/events/Concert-one-e1',
      location: { '@type': 'Place', name: 'Gayana Samaja' },
    });
    // A listing row with no venue gets no location rather than a placeholder one.
    expect(emitted(items[1])).not.toHaveProperty('location');
  });

  it('caps a long December so the ItemList describes the page instead of replacing it', () => {
    const many = Array.from({ length: 80 }, (_, index) => ({
      id: `e${index}`,
      title: `Concert ${index}`,
      startDateTime: '2026-12-20T18:00:00+05:30',
    }));
    expect(eventListItems(many, url)).toHaveLength(50);
    expect(eventListItems(many, url, 5)).toHaveLength(5);
  });
});

describe('itemListJsonLd', () => {
  it('numbers the entries from one, in the order they are shown', () => {
    const out = emitted(itemListJsonLd([{ '@type': 'MusicEvent', name: 'A' }, { name: 'B' }]));
    expect(out.numberOfItems).toBe(2);
    expect(out.itemListElement).toEqual([
      { '@type': 'ListItem', position: 1, item: { '@type': 'MusicEvent', name: 'A' } },
      { '@type': 'ListItem', position: 2, item: { name: 'B' } },
    ]);
  });

  it('emits nothing for an empty listing rather than an empty ItemList', () => {
    expect(itemListJsonLd([])).toBeUndefined();
  });
});
