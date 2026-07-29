import * as Auth from '@rasika/core/auth';
import { ArrowLeft, ArrowRight, Check, Loader2, Plus, X } from 'lucide-react';
import { useEffect, useState } from 'react';
import type { MetaFunction } from 'react-router';
import { Link, data, useLoaderData, useNavigate } from 'react-router';
import { toast } from 'sonner';
import { createServerClient } from '~/api.server';
import { PosterImage } from '~/components/PosterImage';
import { SearchSelect } from '~/components/SearchSelect';
import { Badge } from '~/components/ui/badge';
import { Button } from '~/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '~/components/ui/card';
import { Input } from '~/components/ui/input';
import { Label } from '~/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '~/components/ui/select';
import { Textarea } from '~/components/ui/textarea';
import { requireUser } from '~/lib/auth.server';
import { generateFestivalUrl } from '~/lib/url-slug';

interface ExtractedArtist {
  title?: string;
  name: string;
  role?: string;
  id?: string;
}

interface ExtractedVenue {
  name: string;
  address?: {
    street?: string;
    city?: string;
    state?: string;
    postalCode?: string;
    country?: string;
  };
  id?: string;
}

interface ExtractedOrganiser {
  name: string;
  contactPhone?: string;
  contactEmail?: string;
  id?: string;
}

interface DraftEvent {
  id: string;
  title: string;
  description?: string;
  startDateTime: string;
  endDateTime?: string;
  venue?: ExtractedVenue;
  organiser?: ExtractedOrganiser;
  artists: ExtractedArtist[];
  tags: string[];
  entryType: 'free' | 'ticketed' | 'by-invitation';
  ticketing?: {
    url?: string;
    prices?: Record<string, number>;
    contactPhone?: string;
    contactEmail?: string;
    partnerName?: string;
  };
  contactInfo?: {
    phone?: string;
    email?: string;
    website?: string;
    socialHandles?: string[];
  };
  sponsors?: Array<{ name: string; type?: string }>;
}

interface DraftFestival {
  id: string;
  name: string;
  description?: string;
  startDate: string;
  endDate: string;
  organiser?: ExtractedOrganiser;
  tags: string[];
  sponsors?: Array<{ name: string; type?: string }>;
}

interface EntitySuggestion {
  id: string;
  name: string;
  score: number;
}

interface SuggestionsMap {
  artists: Record<string, EntitySuggestion[]>;
  venues: Record<string, EntitySuggestion[]>;
  organisers: Record<string, EntitySuggestion[]>;
}

interface LoaderData {
  festival: DraftFestival | null;
  events: DraftEvent[];
  posterUrl: string;
  suggestions: SuggestionsMap;
  isModerator: boolean;
  isExistingFestival: boolean;
  festivalUrl?: string;
}

export async function loader({
  request,
}: {
  request: Request;
}) {
  const user = await requireUser(request);
  const isModerator = user.role === Auth.ROLE.MODERATOR || user.role === Auth.ROLE.ADMIN;

  const url = new URL(request.url);
  const festivalId = url.searchParams.get('festivalId');
  const eventIds = url.searchParams.getAll('eventId');
  const posterUrl = url.searchParams.get('posterUrl') || '';
  const existingFestivalParam = url.searchParams.get('existingFestival') === '1';

  const serverClient = await createServerClient(request);

  // Load draft festival if present
  let festival: DraftFestival | null = null;
  let isExistingFestival = false;
  let festivalUrl: string | undefined;
  if (festivalId) {
    const f = await serverClient.festival.getDraft.query({ id: festivalId });
    if (f) {
      festival = {
        id: f.id,
        name: f.name || '',
        description: f.description,
        startDate: f.startDate || '',
        endDate: f.endDate || '',
        organiser: f.organiserName ? { name: f.organiserName } : undefined,
        tags: f.tags || [],
        sponsors: f.sponsors as DraftFestival['sponsors'],
      };
      // Treat as existing (non-editable) if explicitly flagged or if already approved
      if (existingFestivalParam || f.status === 'approved') {
        isExistingFestival = true;
        festivalUrl = generateFestivalUrl(f.name || '', f.id);
      }
    }
  }

  // Load draft events
  const events: DraftEvent[] = [];
  for (const eventId of eventIds) {
    const e = await serverClient.event.getDraft.query({ id: eventId }).catch(() => null);
    if (e) {
      events.push({
        id: e.id,
        title: e.title || '',
        description: e.description,
        startDateTime: e.startDateTime || '',
        endDateTime: e.endDateTime,
        venue: e.venueName ? { name: e.venueName } : undefined,
        organiser: e.organiserName ? { name: e.organiserName } : undefined,
        artists: (e.artists as ExtractedArtist[]) || [],
        tags: (e.tags as string[]) || [],
        entryType: (e.entryType as DraftEvent['entryType']) || 'free',
        ticketing: e.ticketing as DraftEvent['ticketing'],
        contactInfo: e.contactInfo as DraftEvent['contactInfo'],
        sponsors: e.sponsors as DraftEvent['sponsors'],
      });
    }
  }

  // Collect unique names for entity matching
  const artistNames = [...new Set(events.flatMap(e => e.artists.map(a => a.name)).filter(Boolean))];
  const venueNames = [...new Set(events.map(e => e.venue?.name).filter((n): n is string => !!n))];
  const organiserNames = [
    ...new Set(
      [...events.map(e => e.organiser?.name), festival?.organiser?.name].filter(
        (n): n is string => !!n
      )
    ),
  ];

  // Fetch entity suggestions
  const suggestions: SuggestionsMap = { artists: {}, venues: {}, organisers: {} };
  if (artistNames.length > 0 || venueNames.length > 0 || organiserNames.length > 0) {
    try {
      const matched = await serverClient.event.matchEntities.query({
        artistNames,
        venueNames,
        organiserNames,
      });
      suggestions.artists = matched.artists;
      suggestions.venues = matched.venues;
      suggestions.organisers = matched.organisers;
    } catch (err) {
      console.error('[Verify] matchEntities failed, continuing without suggestions:', err);
    }
  }

  // Auto-link exact matches (score === 0) into draft data
  for (const event of events) {
    for (const artist of event.artists) {
      if (!artist.id) {
        const key = artist.name.toLowerCase();
        const exact = suggestions.artists[key]?.find(s => s.score === 0);
        if (exact) {
          artist.id = exact.id;
          artist.name = exact.name;
        }
      }
    }
    if (event.venue && !event.venue.id) {
      const key = event.venue.name.toLowerCase();
      const exact = suggestions.venues[key]?.find(s => s.score === 0);
      if (exact) {
        event.venue.id = exact.id;
        event.venue.name = exact.name;
      }
    }
    if (event.organiser && !event.organiser.id) {
      const key = event.organiser.name.toLowerCase();
      const exact = suggestions.organisers[key]?.find(s => s.score === 0);
      if (exact) {
        event.organiser.id = exact.id;
        event.organiser.name = exact.name;
      }
    }
  }
  if (festival?.organiser && !festival.organiser.id) {
    const key = festival.organiser.name.toLowerCase();
    const exact = suggestions.organisers[key]?.find(s => s.score === 0);
    if (exact) {
      festival.organiser.id = exact.id;
      festival.organiser.name = exact.name;
    }
  }

  return data({
    festival,
    events,
    posterUrl,
    suggestions,
    isModerator,
    isExistingFestival,
    festivalUrl,
  });
}

export const meta: MetaFunction = () => {
  return [
    { title: 'Verify Event Details - Rasika.life' },
    {
      name: 'description',
      content: 'Review and verify extracted event details before publishing.',
    },
    { name: 'robots', content: 'noindex, nofollow' },
  ];
};

// --- Tag Input Component ---
function TagInput({
  tags,
  onChange,
}: {
  tags: string[];
  onChange: (tags: string[]) => void;
}) {
  const [inputValue, setInputValue] = useState('');

  const addTag = () => {
    const tag = inputValue.trim().toLowerCase();
    if (tag && !tags.includes(tag)) {
      onChange([...tags, tag]);
    }
    setInputValue('');
  };

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-1">
        {tags.map(tag => (
          <Badge key={tag} variant="secondary" className="gap-1">
            {tag}
            <button
              type="button"
              onClick={() => onChange(tags.filter(t => t !== tag))}
              className="ml-1 hover:text-destructive"
            >
              <X className="h-3 w-3" />
            </button>
          </Badge>
        ))}
      </div>
      <div className="flex gap-2">
        {/* The section's Label names the tag list; this field is the entry box beside it. */}
        <Input
          aria-label="Add tag"
          value={inputValue}
          onChange={e => setInputValue(e.target.value)}
          onKeyDown={e => {
            if (e.key === 'Enter') {
              e.preventDefault();
              addTag();
            }
          }}
          placeholder="Add tag..."
          className="flex-1"
        />
        <Button type="button" variant="outline" size="sm" onClick={addTag}>
          <Plus className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}

// --- Suggestion Chips Component ---
function SuggestionChips({
  suggestions,
  currentId,
  onSelect,
}: {
  suggestions: EntitySuggestion[];
  currentId?: string;
  onSelect: (suggestion: EntitySuggestion) => void;
}) {
  const filtered = suggestions.filter(s => s.id !== currentId);
  if (filtered.length === 0) return null;

  return (
    <div className="flex items-center gap-1.5 flex-wrap">
      <span className="text-xs text-muted-foreground">Suggestions:</span>
      {filtered.map(s => (
        <button
          key={s.id}
          type="button"
          onClick={() => onSelect(s)}
          className={`inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full border transition-colors hover:bg-accent ${
            s.score === 0 ? 'border-success/40 bg-success/10' : 'border-border bg-muted'
          }`}
        >
          {s.score === 0 && <Check className="h-3 w-3 text-success" />}
          {s.name}
        </button>
      ))}
    </div>
  );
}

// --- Phones Input Component ---
function PhonesInput({
  value,
  onChange,
}: {
  value?: string;
  onChange: (value: string | undefined) => void;
}) {
  const [phones, setPhones] = useState<string[]>(() => {
    const parts = (value || '').split('\n').filter(Boolean);
    return parts.length > 0 ? parts : [''];
  });

  const commit = (updated: string[]) => {
    setPhones(updated);
    const joined = updated
      .map(p => p.trim())
      .filter(Boolean)
      .join('\n');
    onChange(joined || undefined);
  };

  return (
    <div className="space-y-2">
      {phones.map((phone, i) => (
        <div key={`phone-${i}`} className="flex gap-2">
          {/* Repeated row under the section's own "Contact Phone(s)" Label; numbered so the
              rows are distinguishable when read out one after another. */}
          <Input
            aria-label={`Contact phone ${i + 1}`}
            value={phone}
            onChange={e => commit(phones.map((p, j) => (j === i ? e.target.value : p)))}
            placeholder="+91 98765 43210"
          />
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => {
              const filtered = phones.filter((_, j) => j !== i);
              commit(filtered.length ? filtered : ['']);
            }}
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      ))}
      <Button
        type="button"
        variant="ghost"
        size="sm"
        className="h-7 text-xs px-2"
        onClick={() => setPhones(prev => [...prev, ''])}
      >
        <Plus className="h-3 w-3 mr-1" />
        Add number
      </Button>
    </div>
  );
}

// --- Artist Search/Link Component ---
function ArtistRow({
  artist,
  onChange,
  onRemove,
  suggestions,
}: {
  artist: ExtractedArtist;
  onChange: (artist: ExtractedArtist) => void;
  onRemove: () => void;
  suggestions?: EntitySuggestion[];
}) {
  return (
    <div className="border rounded-lg p-3 space-y-2">
      <div className="flex items-start gap-2">
        <div className="flex-1 grid grid-cols-1 sm:grid-cols-[5rem_1fr_8rem] gap-2">
          {/* A three-column repeated row. A visible Label per cell would triple the height of
              every artist entry, so these carry aria-label instead (DESIGN.md density rule). */}
          <Input
            aria-label="Artist title or honorific"
            value={artist.title || ''}
            onChange={e => onChange({ ...artist, title: e.target.value || undefined })}
            placeholder="Title"
          />
          <Input
            aria-label="Artist name"
            value={artist.name}
            onChange={e => onChange({ ...artist, name: e.target.value })}
            placeholder="Artist name"
          />
          <Input
            aria-label="Artist role"
            value={artist.role || ''}
            onChange={e => onChange({ ...artist, role: e.target.value || undefined })}
            placeholder="Role"
          />
        </div>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="flex-shrink-0"
          onClick={onRemove}
        >
          <X className="h-4 w-4" />
        </Button>
      </div>

      {suggestions && !artist.id && (
        <SuggestionChips
          suggestions={suggestions}
          currentId={artist.id}
          onSelect={s => onChange({ ...artist, id: s.id, name: s.name })}
        />
      )}

      <SearchSelect
        label="Link artist"
        placeholder="Search existing artists..."
        searchUrl="/api/search/artist"
        value={artist.id ? { id: artist.id, name: artist.name } : null}
        onChange={entity => {
          if (entity) {
            onChange({ ...artist, id: entity.id, name: entity.name });
          } else {
            onChange({ ...artist, id: undefined });
          }
        }}
        createNew={name => onChange({ ...artist, name, id: undefined })}
      />
    </div>
  );
}

// --- Festival Step ---
function FestivalStep({
  festival,
  onChange,
  posterUrl,
  suggestions,
}: {
  festival: DraftFestival;
  onChange: (festival: DraftFestival) => void;
  posterUrl: string;
  suggestions: SuggestionsMap;
}) {
  return (
    <div className="space-y-6">
      <div className="grid md:grid-cols-[200px_1fr] gap-6">
        {posterUrl && (
          <PosterImage
            posterUrl={posterUrl}
            alt="Poster"
            className="rounded-lg w-full object-cover"
          />
        )}
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="festival-name">Festival Name</Label>
            <Input
              id="festival-name"
              value={festival.name}
              onChange={e => onChange({ ...festival, name: e.target.value })}
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="festival-description">Description</Label>
            <Textarea
              id="festival-description"
              value={festival.description || ''}
              onChange={e => onChange({ ...festival, description: e.target.value || undefined })}
              rows={3}
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="festival-start-date">Start Date</Label>
              <Input
                id="festival-start-date"
                type="date"
                value={festival.startDate?.split('T')[0] || ''}
                onChange={e => onChange({ ...festival, startDate: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="festival-end-date">End Date</Label>
              <Input
                id="festival-end-date"
                type="date"
                value={festival.endDate?.split('T')[0] || ''}
                onChange={e => onChange({ ...festival, endDate: e.target.value })}
              />
            </div>
          </div>
        </div>
      </div>

      <div className="space-y-2">
        <Label>Organiser</Label>
        <div className="border rounded-lg p-3 space-y-2">
          <Input
            // "Organiser" Label above covers this whole block, including the SearchSelect
            // below with its own "Link organiser" label — see DESIGN.md density rule.
            aria-label="Organiser name"
            value={festival.organiser?.name || ''}
            onChange={e =>
              onChange({
                ...festival,
                organiser: e.target.value
                  ? { ...festival.organiser, name: e.target.value, id: undefined }
                  : undefined,
              })
            }
            placeholder="Organiser name"
          />
          {festival.organiser?.name && !festival.organiser.id && (
            <SuggestionChips
              suggestions={suggestions.organisers[festival.organiser.name.toLowerCase()] || []}
              currentId={festival.organiser.id}
              onSelect={s =>
                onChange({
                  ...festival,
                  organiser: { ...festival.organiser, name: s.name, id: s.id },
                })
              }
            />
          )}
          <SearchSelect
            label="Link organiser"
            placeholder="Search existing organisers..."
            searchUrl="/api/search/organiser"
            value={
              festival.organiser?.id
                ? { id: festival.organiser.id, name: festival.organiser.name }
                : null
            }
            onChange={entity => {
              if (entity) {
                onChange({
                  ...festival,
                  organiser: { ...festival.organiser, name: entity.name, id: entity.id },
                });
              } else {
                onChange({
                  ...festival,
                  organiser: festival.organiser
                    ? { ...festival.organiser, id: undefined }
                    : undefined,
                });
              }
            }}
            createNew={name =>
              onChange({
                ...festival,
                organiser: { ...festival.organiser, name, id: undefined },
              })
            }
          />
        </div>
      </div>

      <div className="space-y-2">
        <Label>Tags</Label>
        <TagInput tags={festival.tags} onChange={tags => onChange({ ...festival, tags })} />
      </div>
    </div>
  );
}

// --- Event Step ---
function EventStep({
  event,
  onChange,
  suggestions,
}: {
  event: DraftEvent;
  onChange: (event: DraftEvent) => void;
  suggestions: SuggestionsMap;
}) {
  const addArtist = () => {
    onChange({
      ...event,
      artists: [...event.artists, { name: '', role: '' }],
    });
  };

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <Label htmlFor="event-title">Event Title</Label>
        <Input
          id="event-title"
          value={event.title}
          onChange={e => onChange({ ...event, title: e.target.value })}
          required
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="event-description">Description</Label>
        <Textarea
          id="event-description"
          value={event.description || ''}
          onChange={e => onChange({ ...event, description: e.target.value || undefined })}
          rows={2}
        />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="event-start">Start</Label>
          <Input
            id="event-start"
            type="datetime-local"
            value={event.startDateTime?.slice(0, 16) || ''}
            onChange={e => onChange({ ...event, startDateTime: e.target.value })}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="event-end">End</Label>
          <Input
            id="event-end"
            type="datetime-local"
            value={event.endDateTime?.slice(0, 16) || ''}
            onChange={e => onChange({ ...event, endDateTime: e.target.value || undefined })}
          />
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="event-entry-type">Entry Type</Label>
        <Select
          value={event.entryType}
          onValueChange={value =>
            onChange({ ...event, entryType: value as DraftEvent['entryType'] })
          }
        >
          {/* The id goes on the trigger, not the Radix root: the trigger is the focusable
              element the Label needs to point at. */}
          <SelectTrigger id="event-entry-type">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="free">Free</SelectItem>
            <SelectItem value="ticketed">Ticketed</SelectItem>
            <SelectItem value="by-invitation">By Invitation</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {event.entryType === 'ticketed' && (
        <div className="space-y-2">
          <Label>Ticketing Details</Label>
          <div className="border rounded-lg p-3 space-y-3">
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground" htmlFor="ticketing-url">
                Booking URL
              </Label>
              <Input
                id="ticketing-url"
                type="url"
                value={event.ticketing?.url || ''}
                onChange={e =>
                  onChange({
                    ...event,
                    ticketing: { ...event.ticketing, url: e.target.value || undefined },
                  })
                }
                placeholder="https://..."
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">Contact Phone(s)</Label>
                <PhonesInput
                  value={event.ticketing?.contactPhone}
                  onChange={contactPhone =>
                    onChange({
                      ...event,
                      ticketing: { ...event.ticketing, contactPhone },
                    })
                  }
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground" htmlFor="ticketing-email">
                  Contact Email
                </Label>
                <Input
                  id="ticketing-email"
                  type="email"
                  value={event.ticketing?.contactEmail || ''}
                  onChange={e =>
                    onChange({
                      ...event,
                      ticketing: {
                        ...event.ticketing,
                        contactEmail: e.target.value || undefined,
                      },
                    })
                  }
                />
              </div>
            </div>
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground" htmlFor="ticketing-partner">
                Ticketing Partner
              </Label>
              <Input
                id="ticketing-partner"
                value={event.ticketing?.partnerName || ''}
                onChange={e =>
                  onChange({
                    ...event,
                    ticketing: {
                      ...event.ticketing,
                      partnerName: e.target.value || undefined,
                    },
                  })
                }
                placeholder="e.g. BookMyShow, insider.in"
              />
            </div>
          </div>
        </div>
      )}

      <div className="space-y-2">
        <Label>Venue</Label>
        <div className="border rounded-lg p-3 space-y-2">
          {/* The Venue Label names this whole block, which also holds a SearchSelect. */}
          <Input
            aria-label="Venue name"
            value={event.venue?.name || ''}
            onChange={e =>
              onChange({
                ...event,
                venue: e.target.value
                  ? { ...event.venue, name: e.target.value, id: undefined }
                  : undefined,
              })
            }
            placeholder="Venue name"
          />
          {event.venue?.name && !event.venue.id && (
            <SuggestionChips
              suggestions={suggestions.venues[event.venue.name.toLowerCase()] || []}
              currentId={event.venue.id}
              onSelect={s =>
                onChange({
                  ...event,
                  venue: { ...event.venue, name: s.name, id: s.id },
                })
              }
            />
          )}
          <SearchSelect
            label="Link venue"
            placeholder="Search existing venues..."
            searchUrl="/api/search/venue"
            value={event.venue?.id ? { id: event.venue.id, name: event.venue.name } : null}
            onChange={entity => {
              if (entity) {
                onChange({
                  ...event,
                  venue: { ...event.venue, name: entity.name, id: entity.id },
                });
              } else {
                onChange({
                  ...event,
                  venue: event.venue ? { ...event.venue, id: undefined } : undefined,
                });
              }
            }}
            createNew={name =>
              onChange({
                ...event,
                venue: { ...event.venue, name, id: undefined },
              })
            }
          />
        </div>
      </div>

      <div className="space-y-2">
        <Label>Organiser</Label>
        <div className="border rounded-lg p-3 space-y-2">
          {/* The Organiser Label names this whole block, which also holds a SearchSelect. */}
          <Input
            aria-label="Organiser name"
            value={event.organiser?.name || ''}
            onChange={e =>
              onChange({
                ...event,
                organiser: e.target.value
                  ? { ...event.organiser, name: e.target.value, id: undefined }
                  : undefined,
              })
            }
            placeholder="Organiser name"
          />
          {event.organiser?.name && !event.organiser.id && (
            <SuggestionChips
              suggestions={suggestions.organisers[event.organiser.name.toLowerCase()] || []}
              currentId={event.organiser.id}
              onSelect={s =>
                onChange({
                  ...event,
                  organiser: { ...event.organiser, name: s.name, id: s.id },
                })
              }
            />
          )}
          <SearchSelect
            label="Link organiser"
            placeholder="Search existing organisers..."
            searchUrl="/api/search/organiser"
            value={
              event.organiser?.id ? { id: event.organiser.id, name: event.organiser.name } : null
            }
            onChange={entity => {
              if (entity) {
                onChange({
                  ...event,
                  organiser: { ...event.organiser, name: entity.name, id: entity.id },
                });
              } else {
                onChange({
                  ...event,
                  organiser: event.organiser ? { ...event.organiser, id: undefined } : undefined,
                });
              }
            }}
            createNew={name =>
              onChange({
                ...event,
                organiser: { ...event.organiser, name, id: undefined },
              })
            }
          />
        </div>
      </div>

      <div className="space-y-2">
        <Label>Artists</Label>
        <div className="space-y-2">
          {event.artists.map((artist, i) => (
            <ArtistRow
              key={`artist-${i}`}
              artist={artist}
              suggestions={suggestions.artists[artist.name.toLowerCase()]}
              onChange={updated => {
                const artists = [...event.artists];
                artists[i] = updated;
                onChange({ ...event, artists });
              }}
              onRemove={() => {
                onChange({
                  ...event,
                  artists: event.artists.filter((_, idx) => idx !== i),
                });
              }}
            />
          ))}
          <Button type="button" variant="outline" size="sm" onClick={addArtist}>
            <Plus className="h-4 w-4 mr-1" />
            Add Artist
          </Button>
        </div>
      </div>

      <div className="space-y-2">
        <Label>Tags</Label>
        <TagInput tags={event.tags} onChange={tags => onChange({ ...event, tags })} />
      </div>
    </div>
  );
}

// --- Review Step ---
function ReviewStep({
  festival,
  events,
  posterUrl,
}: {
  festival: DraftFestival | null;
  events: DraftEvent[];
  posterUrl: string;
}) {
  const newArtists = events
    .flatMap(e => e.artists)
    .filter(a => !a.id)
    .map(a => `${a.title ? `${a.title} ` : ''}${a.name}`);

  const uniqueNewArtists = [...new Set(newArtists)];

  return (
    <div className="space-y-6">
      {festival && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Festival: {festival.name}</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground space-y-1">
            {festival.description && <p>{festival.description}</p>}
            <p>
              {festival.startDate} - {festival.endDate}
            </p>
            {festival.organiser && <p>Organiser: {festival.organiser.name}</p>}
            {festival.tags.length > 0 && (
              <div className="flex gap-1 flex-wrap">
                {festival.tags.map(tag => (
                  <Badge key={tag} variant="outline">
                    {tag}
                  </Badge>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      <div>
        <h3 className="font-semibold mb-3">Events ({events.length})</h3>
        <div className="space-y-3">
          {events.map((event, i) => (
            <Card key={event.id}>
              <CardContent className="py-3 text-sm">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="font-medium">{event.title}</p>
                    <p className="text-muted-foreground">
                      {event.startDateTime &&
                        new Date(event.startDateTime).toLocaleString('en-IN', {
                          dateStyle: 'medium',
                          timeStyle: 'short',
                        })}
                    </p>
                    {event.venue && <p className="text-muted-foreground">at {event.venue.name}</p>}
                    {event.organiser && (
                      <p className="text-muted-foreground">by {event.organiser.name}</p>
                    )}
                  </div>
                  <Badge variant="outline">{event.entryType}</Badge>
                </div>
                {event.artists.length > 0 && (
                  <div className="mt-2 text-muted-foreground">
                    {event.artists.map((a, j) => (
                      <span key={`review-artist-${j}`}>
                        {j > 0 && ', '}
                        {a.title ? `${a.title} ` : ''}
                        {a.name}
                        {a.role && ` (${a.role})`}
                        {a.id && ' \u2713'}
                      </span>
                    ))}
                  </div>
                )}
                {event.entryType === 'ticketed' && event.ticketing?.url && (
                  <p className="mt-1 text-xs text-muted-foreground">
                    Tickets:{' '}
                    <a
                      href={event.ticketing.url}
                      className="underline hover:text-foreground"
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      {event.ticketing.url}
                    </a>
                  </p>
                )}
                {event.tags.length > 0 && (
                  <div className="mt-2 flex gap-1 flex-wrap">
                    {event.tags.map(tag => (
                      <Badge key={tag} variant="secondary" className="text-xs">
                        {tag}
                      </Badge>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      </div>

      {uniqueNewArtists.length > 0 && (
        <div className="bg-muted border border-border rounded-lg p-4">
          <h4 className="text-sm font-medium mb-2">New artist profiles to create:</h4>
          <ul className="text-sm text-muted-foreground space-y-1">
            {uniqueNewArtists.map(name => (
              <li key={name}>{name}</li>
            ))}
          </ul>
        </div>
      )}

      {posterUrl && (
        <div>
          <h4 className="text-sm font-medium mb-2">Poster</h4>
          <PosterImage posterUrl={posterUrl} alt="Event poster" className="max-h-48 rounded-lg" />
        </div>
      )}
    </div>
  );
}

// --- Main Wizard ---
export default function VerifyEvents() {
  const loaderData = useLoaderData<LoaderData>();
  const { isModerator, isExistingFestival, festivalUrl } = loaderData;
  const navigate = useNavigate();

  // Stable key scoped to this specific set of drafts
  const storageKey = `verify-draft-${[loaderData.festival?.id ?? '', ...loaderData.events.map(e => e.id)].join('-')}`;

  const [festival, setFestival] = useState<DraftFestival | null>(loaderData.festival);
  const [events, setEvents] = useState<DraftEvent[]>(loaderData.events);
  const [currentStep, setCurrentStep] = useState(0);
  const [isSubmitting, setIsSubmitting] = useState(false);
  // Tracks whether the one-time restore from sessionStorage has run
  const [hasRestored, setHasRestored] = useState(false);

  // Restore saved progress on mount (client-only via useEffect)
  useEffect(() => {
    try {
      const saved = sessionStorage.getItem(storageKey);
      if (saved) {
        const parsed = JSON.parse(saved) as {
          festival?: DraftFestival | null;
          events?: DraftEvent[];
          step?: number;
        };
        if (parsed.festival !== undefined) setFestival(parsed.festival);
        if (parsed.events) setEvents(parsed.events);
        if (typeof parsed.step === 'number') setCurrentStep(parsed.step);
      }
    } catch {
      // sessionStorage unavailable or data corrupt — start fresh
    }
    setHasRestored(true);
  }, [storageKey]);

  // Auto-save to sessionStorage whenever state changes (after restore completes)
  useEffect(() => {
    if (!hasRestored) return;
    try {
      sessionStorage.setItem(storageKey, JSON.stringify({ festival, events, step: currentStep }));
    } catch {
      // sessionStorage unavailable — silently skip
    }
  }, [festival, events, currentStep, storageKey, hasRestored]);

  const editingFestival = festival !== null && !isExistingFestival;
  const totalSteps = (editingFestival ? 1 : 0) + events.length + 1; // +1 for review
  const isReviewStep = currentStep === totalSteps - 1;
  const isFestivalStep = editingFestival && currentStep === 0;
  const eventIndex = editingFestival ? currentStep - 1 : currentStep;

  const getStepLabel = () => {
    if (isFestivalStep) return 'Festival Details';
    if (isReviewStep) return isModerator ? 'Review & Publish' : 'Review & Submit';
    return `Event ${eventIndex + 1} — ${events[eventIndex]?.title || 'Untitled'}`;
  };

  const normalizeDateTime = (dt?: string) => {
    if (!dt) return dt;
    // datetime-local gives "YYYY-MM-DDTHH:MM", add seconds if missing
    if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(dt)) return `${dt}:00+05:30`;
    // Already has offset or Z — return as-is
    if (/[Z+-]/.test(dt.slice(10))) return dt;
    // Has seconds but no offset — add IST
    return `${dt}+05:30`;
  };

  const handleSubmit = async () => {
    setIsSubmitting(true);
    try {
      const response = await fetch('/events/new/api', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          intent: 'submit',
          festivalId: festival?.id,
          festivalData:
            festival && !isExistingFestival
              ? {
                  name: festival.name,
                  description: festival.description,
                  startDate: festival.startDate,
                  endDate: festival.endDate,
                  tags: festival.tags,
                  sponsors: festival.sponsors,
                }
              : undefined,
          events: events.map(e => ({
            id: e.id,
            title: e.title,
            description: e.description,
            startDateTime: normalizeDateTime(e.startDateTime),
            endDateTime: normalizeDateTime(e.endDateTime),
            venueName: e.venue?.name,
            venueId: e.venue?.id,
            organiserName: e.organiser?.name,
            organiserId: e.organiser?.id,
            artists: e.artists,
            tags: e.tags,
            entryType: e.entryType,
            ticketing: e.ticketing,
            contactInfo: e.contactInfo,
            sponsors: e.sponsors,
            posterUrl: loaderData.posterUrl,
          })),
        }),
      });

      if (!response.ok) {
        const err = await response.json().catch(() => null);
        throw new Error(err?.error || 'Failed to submit');
      }

      try {
        sessionStorage.removeItem(storageKey);
      } catch {
        // ignore
      }
      toast.success(isModerator ? 'Events published!' : 'Events submitted for review!');
      navigate(isExistingFestival && festivalUrl ? festivalUrl : '/events');
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to submit events.';
      toast.error(message);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <main className="container mx-auto px-4 py-8 max-w-3xl">
      {isExistingFestival && festival && festivalUrl && (
        <div className="mb-6 flex items-center gap-2 text-sm text-muted-foreground bg-muted/50 rounded-lg px-4 py-2">
          <span>Adding events to</span>
          <Link to={festivalUrl} className="font-medium text-foreground hover:underline">
            {festival.name}
          </Link>
        </div>
      )}
      <header className="mb-6">
        <p className="text-sm text-muted-foreground mb-1">
          Step {currentStep + 1} of {totalSteps}
        </p>
        <h1 className="text-2xl font-bold">{getStepLabel()}</h1>
        <div className="mt-3 flex gap-1">
          {Array.from({ length: totalSteps }).map((_, i) => (
            <div
              key={`step-${i}`}
              className={`h-1 flex-1 rounded-full transition-colors ${
                i <= currentStep ? 'bg-primary' : 'bg-muted'
              }`}
            />
          ))}
        </div>
      </header>

      <div className="bg-card rounded-lg border p-6">
        {isFestivalStep && festival && (
          <FestivalStep
            festival={festival}
            onChange={setFestival}
            posterUrl={loaderData.posterUrl}
            suggestions={loaderData.suggestions}
          />
        )}

        {!isFestivalStep && !isReviewStep && events[eventIndex] && (
          <EventStep
            key={events[eventIndex].id}
            event={events[eventIndex]}
            suggestions={loaderData.suggestions}
            onChange={updated => {
              const newEvents = [...events];
              newEvents[eventIndex] = updated;
              setEvents(newEvents);
            }}
          />
        )}

        {isReviewStep && (
          <ReviewStep festival={festival} events={events} posterUrl={loaderData.posterUrl} />
        )}
      </div>

      <div className="mt-6 flex justify-between">
        <Button
          variant="outline"
          onClick={() => setCurrentStep(s => s - 1)}
          disabled={currentStep === 0}
        >
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back
        </Button>

        {isReviewStep ? (
          <Button onClick={handleSubmit} disabled={isSubmitting}>
            {isSubmitting ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                {isModerator ? 'Publishing...' : 'Submitting...'}
              </>
            ) : (
              <>
                <Check className="mr-2 h-4 w-4" />
                {isModerator ? 'Publish' : 'Submit for Review'}
              </>
            )}
          </Button>
        ) : (
          <Button onClick={() => setCurrentStep(s => s + 1)}>
            Next
            <ArrowRight className="ml-2 h-4 w-4" />
          </Button>
        )}
      </div>
    </main>
  );
}
