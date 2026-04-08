import { EditEntityTypes, EditStatus } from '@rasika/core/domain/edit/client';
import { ArrowLeft, Loader2, Pencil, Plus, Save, Trash2, X } from 'lucide-react';
import { useEffect, useState } from 'react';
import type { MetaFunction } from 'react-router';
import { Form, data, redirect, useActionData, useLoaderData, useNavigation } from 'react-router';
import { toast } from 'sonner';
import { createServerClient } from '~/api.server';
import { Breadcrumb } from '~/components/Breadcrumb';
import { Badge } from '~/components/ui/badge';
import { Button } from '~/components/ui/button';
import { Input } from '~/components/ui/input';
import { Label } from '~/components/ui/label';
import { Textarea } from '~/components/ui/textarea';
import { getUser } from '~/lib/auth.server';
import { generateEventUrl, parseSlug } from '~/lib/url-slug';

export const meta: MetaFunction = () => {
  return [{ name: 'robots', content: 'noindex, nofollow' }];
};

interface ArtistEntry {
  id?: string;
  name: string;
  title?: string;
  role?: string;
}

export async function loader({
  request,
  params,
}: {
  request: Request;
  params: { eventid?: string };
}) {
  const user = await getUser(request);
  if (!user) {
    return redirect(`/auth/login?redirectTo=${new URL(request.url).pathname}`);
  }

  const { eventid } = params;
  if (!eventid) {
    throw new Response('Event ID is required', { status: 400 });
  }

  const parsed = parseSlug(eventid);
  if (!parsed) {
    throw new Response('Invalid URL format', { status: 400 });
  }

  const { id: slugId } = parsed;
  const serverClient = await createServerClient(request);
  const event = await serverClient.event.get.query({ id: slugId });

  if (!event) {
    throw new Response('Event not found', { status: 404 });
  }

  if (event.status !== 'approved') {
    throw new Response('Only approved events can be edited via this form', { status: 400 });
  }

  const activeEdit = await serverClient.edit.getActiveEditForEntity.query({
    entityType: EditEntityTypes.EVENT,
    entityId: event.id,
  });

  if (activeEdit?.status === EditStatus.SUBMITTED) {
    return redirect(`/my-edits?editId=${activeEdit.id}`);
  }

  return data({ event, user, activeEdit });
}

export async function action({
  request,
  params,
}: {
  request: Request;
  params: { eventid?: string };
}) {
  const user = await getUser(request);
  if (!user) {
    return redirect('/auth/login');
  }

  const { eventid } = params;
  if (!eventid) {
    return data({ error: 'Event ID is required' }, { status: 400 });
  }

  const parsed = parseSlug(eventid);
  if (!parsed) {
    return data({ error: 'Invalid URL format' }, { status: 400 });
  }

  const { id: slugId } = parsed;
  const formData = await request.formData();
  const intent = formData.get('intent') as string;

  const serverClient = await createServerClient(request);
  const event = await serverClient.event.get.query({ id: slugId });

  if (!event) {
    return data({ error: 'Event not found' }, { status: 404 });
  }

  const title = formData.get('title') as string;
  const description = formData.get('description') as string;
  const startDateTime = formData.get('startDateTime') as string;
  const endDateTime = formData.get('endDateTime') as string;
  const venueName = formData.get('venueName') as string;
  const organiserName = formData.get('organiserName') as string;
  const entryType = formData.get('entryType') as string;
  const userNote = formData.get('userNote') as string;
  const tagsJson = formData.get('tags') as string;
  const tags: string[] = tagsJson ? (JSON.parse(tagsJson) as string[]) : [];
  const ticketingUrl = (formData.get('ticketing.url') as string) || undefined;
  const ticketingContactPhone = (formData.get('ticketing.contactPhone') as string) || undefined;
  const ticketingContactEmail = (formData.get('ticketing.contactEmail') as string) || undefined;
  const ticketingPartnerName = (formData.get('ticketing.partnerName') as string) || undefined;

  // Parse artists from form (indexed fields)
  const artists: ArtistEntry[] = [];
  let i = 0;
  while (formData.has(`artists[${i}].name`)) {
    const name = formData.get(`artists[${i}].name`) as string;
    if (name) {
      artists.push({
        id: (formData.get(`artists[${i}].id`) as string) || undefined,
        name,
        title: (formData.get(`artists[${i}].title`) as string) || undefined,
        role: (formData.get(`artists[${i}].role`) as string) || undefined,
      });
    }
    i++;
  }

  const proposedValues: Record<string, unknown> = {};

  if (title !== (event.title || '')) proposedValues.title = title;
  if (description !== (event.description || '')) proposedValues.description = description || null;
  if (startDateTime && startDateTime !== (event.startDateTime || ''))
    proposedValues.startDateTime = startDateTime;
  if (endDateTime !== (event.endDateTime || '')) proposedValues.endDateTime = endDateTime || null;
  if (venueName !== (event.venueName || '')) proposedValues.venueName = venueName || null;
  if (organiserName !== (event.organiserName || ''))
    proposedValues.organiserName = organiserName || null;
  if (entryType !== (event.entryType || 'free')) proposedValues.entryType = entryType;

  const currentTags = (event.tags as string[] | null | undefined) ?? [];
  if (JSON.stringify(tags) !== JSON.stringify(currentTags)) proposedValues.tags = tags;

  const hasTicketingFields =
    ticketingUrl !== undefined ||
    ticketingContactPhone !== undefined ||
    ticketingContactEmail !== undefined ||
    ticketingPartnerName !== undefined;
  if (hasTicketingFields) {
    const currentTicketing = event.ticketing as {
      url?: string | null;
      contactPhone?: string | null;
      contactEmail?: string | null;
      partnerName?: string | null;
    } | null;
    const ticketingChanged =
      (ticketingUrl || '') !== (currentTicketing?.url || '') ||
      (ticketingContactPhone || '') !== (currentTicketing?.contactPhone || '') ||
      (ticketingContactEmail || '') !== (currentTicketing?.contactEmail || '') ||
      (ticketingPartnerName || '') !== (currentTicketing?.partnerName || '');
    if (ticketingChanged) {
      proposedValues.ticketing = {
        url: ticketingUrl || null,
        contactPhone: ticketingContactPhone || null,
        contactEmail: ticketingContactEmail || null,
        partnerName: ticketingPartnerName || null,
      };
    }
  }

  // Compare artists
  const currentArtists = (event.artists || []) as Array<{
    id?: string | null;
    name: string;
    title?: string | null;
    role?: string | null;
  }>;
  const artistsChanged =
    artists.length !== currentArtists.length ||
    artists.some((a, idx) => {
      const c = currentArtists[idx];
      return (
        !c ||
        a.name !== c.name ||
        (a.id || '') !== (c.id || '') ||
        (a.role || '') !== (c.role || '') ||
        (a.title || '') !== (c.title || '')
      );
    });
  if (artistsChanged) proposedValues.artists = artists;

  if (Object.keys(proposedValues).length === 0) {
    return data(
      { error: 'No changes detected. Please modify at least one field.' },
      { status: 400 }
    );
  }

  if (intent === 'save-draft' || intent === 'submit') {
    try {
      let editId = formData.get('editId') as string | undefined;

      const result = await serverClient.edit.saveChanges.mutate({
        entityType: EditEntityTypes.EVENT,
        entityId: slugId,
        proposedValues,
        userNote: userNote || undefined,
        editId,
      });

      editId = result.id;

      if (intent === 'submit') {
        await serverClient.edit.submit.mutate({ editId });
        return data({
          success: true,
          redirectUrl: generateEventUrl(title || event.title, slugId),
        });
      }

      return data({ success: true, editId });
    } catch (error) {
      console.error('Failed to save changes:', error);
      return data({ error: 'Failed to save changes. Please try again.' }, { status: 500 });
    }
  }

  return data({ error: 'Invalid action' }, { status: 400 });
}

export default function EditEvent() {
  const { event, activeEdit } = useLoaderData<typeof loader>();
  const actionData = useActionData<typeof action>();
  const navigation = useNavigation();
  const eventUrl = generateEventUrl(event.title, event.id);

  const proposed = activeEdit?.proposedValues || {};

  const [artists, setArtists] = useState<ArtistEntry[]>(
    (
      (proposed.artists as ArtistEntry[] | undefined) ||
      (event.artists as ArtistEntry[] | undefined) ||
      []
    ).map(a => ({
      id: a.id || undefined,
      name: a.name,
      title: a.title || undefined,
      role: a.role || undefined,
    }))
  );

  const defaultValues = {
    title: (proposed.title as string | undefined) || event.title,
    description:
      (proposed.description as string | undefined) ??
      (event.description as string | undefined) ??
      '',
    startDateTime: (proposed.startDateTime as string | undefined) || event.startDateTime,
    endDateTime:
      (proposed.endDateTime as string | undefined) ??
      (event.endDateTime as string | undefined) ??
      '',
    venueName:
      (proposed.venueName as string | undefined) ?? (event.venueName as string | undefined) ?? '',
    organiserName:
      (proposed.organiserName as string | undefined) ??
      (event.organiserName as string | undefined) ??
      '',
    entryType:
      (proposed.entryType as string | undefined) ||
      (event.entryType as string | undefined) ||
      'free',
    userNote: activeEdit?.userNote || '',
  };

  const [tags, setTags] = useState<string[]>(
    (proposed.tags as string[] | undefined) ?? (event.tags as string[] | undefined) ?? []
  );
  const [tagInput, setTagInput] = useState('');
  const [currentEntryType, setCurrentEntryType] = useState(defaultValues.entryType);
  const initialTicketing =
    (proposed.ticketing as
      | {
          url?: string;
          contactPhone?: string;
          contactEmail?: string;
          partnerName?: string;
        }
      | undefined) ??
    (event.ticketing as
      | {
          url?: string;
          contactPhone?: string;
          contactEmail?: string;
          partnerName?: string;
        }
      | undefined) ??
    {};

  const [ticketingPhones, setTicketingPhones] = useState<string[]>(() => {
    const parts = (initialTicketing.contactPhone || '').split('\n').filter(Boolean);
    return parts.length > 0 ? parts : [''];
  });

  useEffect(() => {
    if (
      actionData &&
      'success' in actionData &&
      actionData.success &&
      'redirectUrl' in actionData
    ) {
      toast.success('Edit submitted for review');
      window.location.href = actionData.redirectUrl as string;
    }
  }, [actionData]);

  function addArtist() {
    setArtists(prev => [...prev, { name: '' }]);
  }

  function removeArtist(idx: number) {
    setArtists(prev => prev.filter((_, i) => i !== idx));
  }

  function updateArtist(idx: number, field: keyof ArtistEntry, value: string) {
    setArtists(prev => prev.map((a, i) => (i === idx ? { ...a, [field]: value } : a)));
  }

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      <Breadcrumb
        items={[
          { label: 'Events', path: '/events' },
          { label: event.title, path: eventUrl },
          { label: activeEdit ? 'Continue Editing' : 'Edit', path: '#' },
        ]}
      />

      <div className="mt-8">
        <div className="flex items-center gap-4 mb-6">
          <h1 className="text-2xl font-bold text-foreground">
            {activeEdit ? 'Continue Editing Event' : 'Edit Event'}
          </h1>
        </div>
        <div className="bg-card rounded-lg shadow-sm border p-6">
          <Form method="post" className="space-y-6">
            {activeEdit && <input type="hidden" name="editId" value={activeEdit.id} />}

            <div className="space-y-2">
              <Label htmlFor="title">Title</Label>
              <Input
                id="title"
                name="title"
                type="text"
                defaultValue={defaultValues.title}
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                name="description"
                rows={4}
                defaultValue={defaultValues.description}
              />
            </div>

            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="startDateTime">Start Date &amp; Time</Label>
                <Input
                  id="startDateTime"
                  name="startDateTime"
                  type="datetime-local"
                  defaultValue={defaultValues.startDateTime?.slice(0, 16)}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="endDateTime">End Date &amp; Time</Label>
                <Input
                  id="endDateTime"
                  name="endDateTime"
                  type="datetime-local"
                  defaultValue={defaultValues.endDateTime?.slice(0, 16)}
                />
              </div>
            </div>

            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="venueName">Venue Name</Label>
                <Input
                  id="venueName"
                  name="venueName"
                  type="text"
                  defaultValue={defaultValues.venueName}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="organiserName">Organiser Name</Label>
                <Input
                  id="organiserName"
                  name="organiserName"
                  type="text"
                  defaultValue={defaultValues.organiserName}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="entryType">Entry Type</Label>
              <select
                id="entryType"
                name="entryType"
                value={currentEntryType}
                onChange={e => setCurrentEntryType(e.target.value)}
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
              >
                <option value="free">Free</option>
                <option value="ticketed">Ticketed</option>
                <option value="by-invitation">By Invitation</option>
              </select>
            </div>

            {currentEntryType === 'ticketed' && (
              <div className="space-y-3 border rounded-lg p-4">
                <p className="text-sm font-medium">Ticketing Details</p>
                <div className="space-y-2">
                  <Label htmlFor="ticketing.url" className="text-xs">
                    Booking URL
                  </Label>
                  <Input
                    id="ticketing.url"
                    name="ticketing.url"
                    type="url"
                    defaultValue={initialTicketing.url || ''}
                    placeholder="https://..."
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-2">
                    <Label className="text-xs">Contact Phone(s)</Label>
                    <input
                      type="hidden"
                      name="ticketing.contactPhone"
                      value={ticketingPhones.filter(Boolean).join('\n')}
                    />
                    {ticketingPhones.map((phone, i) => (
                      <div key={`tphone-${i}`} className="flex gap-2">
                        <Input
                          value={phone}
                          onChange={e =>
                            setTicketingPhones(prev =>
                              prev.map((p, j) => (j === i ? e.target.value : p))
                            )
                          }
                          placeholder="+91 98765 43210"
                        />
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() =>
                            setTicketingPhones(prev => {
                              const filtered = prev.filter((_, j) => j !== i);
                              return filtered.length ? filtered : [''];
                            })
                          }
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
                      onClick={() => setTicketingPhones(prev => [...prev, ''])}
                    >
                      <Plus className="h-3 w-3 mr-1" />
                      Add number
                    </Button>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="ticketing.contactEmail" className="text-xs">
                      Contact Email
                    </Label>
                    <Input
                      id="ticketing.contactEmail"
                      name="ticketing.contactEmail"
                      type="email"
                      defaultValue={initialTicketing.contactEmail || ''}
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="ticketing.partnerName" className="text-xs">
                    Ticketing Partner
                  </Label>
                  <Input
                    id="ticketing.partnerName"
                    name="ticketing.partnerName"
                    defaultValue={initialTicketing.partnerName || ''}
                    placeholder="e.g. BookMyShow, insider.in"
                  />
                </div>
              </div>
            )}

            {/* Artists */}
            <fieldset className="space-y-3">
              <div className="flex items-center justify-between">
                <legend className="text-sm font-medium">Artists</legend>
                <Button type="button" variant="outline" size="sm" onClick={addArtist}>
                  <Plus className="h-4 w-4 mr-1" />
                  Add Artist
                </Button>
              </div>
              {artists.map((artist, idx) => (
                <div
                  key={idx}
                  className="grid grid-cols-[1fr_1fr_1fr_auto] gap-2 items-end border rounded p-3"
                >
                  <input type="hidden" name={`artists[${idx}].id`} value={artist.id || ''} />
                  <div className="space-y-1">
                    <Label htmlFor={`artists-${idx}-name`} className="text-xs">
                      Name *
                    </Label>
                    <Input
                      id={`artists-${idx}-name`}
                      name={`artists[${idx}].name`}
                      type="text"
                      value={artist.name}
                      onChange={e => updateArtist(idx, 'name', e.target.value)}
                      required
                    />
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor={`artists-${idx}-title`} className="text-xs">
                      Title
                    </Label>
                    <Input
                      id={`artists-${idx}-title`}
                      name={`artists[${idx}].title`}
                      type="text"
                      value={artist.title || ''}
                      onChange={e => updateArtist(idx, 'title', e.target.value)}
                    />
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor={`artists-${idx}-role`} className="text-xs">
                      Role
                    </Label>
                    <Input
                      id={`artists-${idx}-role`}
                      name={`artists[${idx}].role`}
                      type="text"
                      value={artist.role || ''}
                      onChange={e => updateArtist(idx, 'role', e.target.value)}
                    />
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => removeArtist(idx)}
                    className="text-destructive"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              ))}
            </fieldset>

            <div className="space-y-2">
              <Label>Tags</Label>
              <input type="hidden" name="tags" value={JSON.stringify(tags)} />
              {tags.length > 0 && (
                <div className="flex flex-wrap gap-1">
                  {tags.map(tag => (
                    <Badge key={tag} variant="secondary" className="gap-1 text-xs">
                      {tag}
                      <button
                        type="button"
                        onClick={() => setTags(prev => prev.filter(t => t !== tag))}
                        className="ml-0.5 hover:text-destructive"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </Badge>
                  ))}
                </div>
              )}
              <div className="flex gap-2">
                <Input
                  value={tagInput}
                  onChange={e => setTagInput(e.target.value)}
                  onKeyDown={e => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      const tag = tagInput.trim().toLowerCase();
                      if (tag && !tags.includes(tag)) {
                        setTags(prev => [...prev, tag]);
                      }
                      setTagInput('');
                    }
                  }}
                  placeholder="Add tag and press Enter..."
                />
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    const tag = tagInput.trim().toLowerCase();
                    if (tag && !tags.includes(tag)) {
                      setTags(prev => [...prev, tag]);
                    }
                    setTagInput('');
                  }}
                >
                  <Plus className="h-4 w-4" />
                </Button>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="userNote">Edit Note (optional)</Label>
              <Textarea
                id="userNote"
                name="userNote"
                rows={3}
                placeholder="Explain the changes you're making..."
                defaultValue={defaultValues.userNote}
              />
            </div>

            {actionData && 'error' in actionData && (
              <p className="text-sm text-destructive">{actionData.error as string}</p>
            )}

            <div className="flex items-center justify-end gap-4 pt-4 border-t">
              <a
                href={eventUrl}
                className="px-4 py-2 text-sm font-medium text-muted-foreground hover:text-foreground flex items-center gap-2 transition-colors"
              >
                <ArrowLeft className="h-4 w-4" />
                Cancel
              </a>
              <Button variant="ghost" type="submit" name="intent" value="save-draft">
                {navigation.formData?.get('intent') === 'save-draft' ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Saving...
                  </>
                ) : (
                  <>
                    <Save className="h-4 w-4" />
                    Save Draft
                  </>
                )}
              </Button>
              <Button variant="default" type="submit" name="intent" value="submit">
                {navigation.formData?.get('intent') === 'submit' ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Submitting...
                  </>
                ) : (
                  <>
                    <Pencil className="mr-2 h-4 w-4" />
                    Submit for Review
                  </>
                )}
              </Button>
            </div>
          </Form>
        </div>
        <div className="mt-6 bg-yellow-50 border border-yellow-200 rounded-lg p-4 dark:bg-yellow-950 dark:border-yellow-800">
          <h3 className="text-sm font-medium text-yellow-800 dark:text-yellow-200">
            About Edit Submissions
          </h3>
          <p className="mt-1 text-sm text-yellow-700 dark:text-yellow-300">
            Your edit will be submitted for review by a moderator. Once approved, the changes will
            be visible to everyone.
          </p>
        </div>
      </div>
    </div>
  );
}
