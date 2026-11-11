import { Button, EmptyState, Field, Input, SectionTitle } from '@rasika/ui';
import type { ActionFunctionArgs, LoaderFunctionArgs } from 'react-router';
import { Form, data, useActionData, useLoaderData, useNavigation } from 'react-router';
import { useDashboard } from '~/components/dashboard-context';
import { FormError } from '~/components/shell';
import { createServerClient, errorMessage } from '~/lib/api.server';
import { requireUser } from '~/lib/auth.server';
import { SABHA_COPY, SABHA_EXTRA_COPY } from '~/lib/copy';
import { pageMeta } from '~/lib/meta';
import { codesBySpace, isOwner, readSpaceForm } from '~/lib/sabha';

export const meta = () => pageMeta(SABHA_COPY.tabs.spaces);

function venueId(params: LoaderFunctionArgs['params']) {
  if (params.targetType !== 'venue' || !params.id) throw data(null, { status: 404 });
  return params.id;
}

export async function loader({ request, params }: LoaderFunctionArgs) {
  await requireUser(request);
  const id = venueId(params);
  const trpc = await createServerClient(request);
  return { spaces: await trpc.space.list.query({ venueId: id }) };
}

/** Owners create and update halls. There is no delete in v1. */
export async function action({ request, params }: ActionFunctionArgs) {
  await requireUser(request);
  const id = venueId(params);
  const form = await request.formData();
  const read = readSpaceForm(form);
  if (!read.ok)
    return data({ ok: false as const, message: SABHA_EXTRA_COPY.spacesName }, { status: 400 });
  const trpc = await createServerClient(request);
  try {
    if (form.get('intent') === 'update') {
      const spaceId = String(form.get('spaceId') ?? '');
      await trpc.space.update.mutate({ venueId: id, spaceId, ...read.values });
    } else {
      await trpc.space.create.mutate({ venueId: id, ...read.values });
    }
    return { ok: true as const, message: SABHA_EXTRA_COPY.spacesSaved };
  } catch (error) {
    return data({ ok: false as const, message: errorMessage(error) }, { status: 400 });
  }
}

export default function Spaces() {
  const { spaces } = useLoaderData<typeof loader>();
  const { overview } = useDashboard();
  const result = useActionData<typeof action>();
  const navigation = useNavigation();
  const canEdit = isOwner(overview.role as 'owner');
  const bySpace = codesBySpace(overview.codes);
  const venueWide = bySpace.get('') ?? [];

  return (
    <>
      {canEdit ? null : (
        <p className="mb-4 text-sm text-muted-foreground">{SABHA_EXTRA_COPY.spacesOwnersOnly}</p>
      )}
      {result?.message ? (
        result.ok ? (
          <output className="block mb-4 text-sm">{result.message}</output>
        ) : (
          <div className="mb-4">
            <FormError>{result.message}</FormError>
          </div>
        )
      ) : null}

      {spaces.length === 0 ? (
        <div className="mb-8">
          <EmptyState title={SABHA_EXTRA_COPY.spacesNone} />
        </div>
      ) : (
        <ul className="mb-8 space-y-4">
          {spaces.map(space => (
            <li key={space.spaceId} className="rounded-lg border border-border p-4">
              <Form
                method="post"
                className="grid gap-3 md:grid-cols-[2fr_1fr_2fr_auto] md:items-end"
              >
                <input type="hidden" name="intent" value="update" />
                <input type="hidden" name="spaceId" value={space.spaceId} />
                <Field label={SABHA_EXTRA_COPY.spacesName} htmlFor={`name-${space.spaceId}`}>
                  <Input
                    id={`name-${space.spaceId}`}
                    name="name"
                    defaultValue={space.name}
                    disabled={!canEdit}
                    required
                  />
                </Field>
                <Field label={SABHA_EXTRA_COPY.spacesCapacity} htmlFor={`cap-${space.spaceId}`}>
                  <Input
                    id={`cap-${space.spaceId}`}
                    name="capacity"
                    type="number"
                    min={1}
                    defaultValue={space.capacity ?? ''}
                    disabled={!canEdit}
                  />
                </Field>
                <Field label={SABHA_EXTRA_COPY.spacesNotes} htmlFor={`notes-${space.spaceId}`}>
                  <Input
                    id={`notes-${space.spaceId}`}
                    name="notes"
                    defaultValue={space.notes ?? ''}
                    disabled={!canEdit}
                  />
                </Field>
                {canEdit ? (
                  <Button
                    type="submit"
                    variant="secondary"
                    pending={navigation.state === 'submitting'}
                  >
                    {SABHA_EXTRA_COPY.spacesSave}
                  </Button>
                ) : null}
              </Form>
              <p className="mt-3 text-sm text-muted-foreground">
                {SABHA_EXTRA_COPY.spacesCodes}:{' '}
                {(bySpace.get(space.spaceId) ?? []).length === 0
                  ? SABHA_EXTRA_COPY.spacesNoCodes
                  : (bySpace.get(space.spaceId) ?? [])
                      .map(code => (code.label ? `${code.code} (${code.label})` : code.code))
                      .join(', ')}
              </p>
            </li>
          ))}
        </ul>
      )}

      {venueWide.length > 0 ? (
        <p className="mb-8 text-sm text-muted-foreground">
          {SABHA_EXTRA_COPY.spacesVenueWide}:{' '}
          {venueWide
            .map(code => (code.label ? `${code.code} (${code.label})` : code.code))
            .join(', ')}
        </p>
      ) : null}

      {canEdit ? (
        <>
          <SectionTitle>{SABHA_EXTRA_COPY.spacesAdd}</SectionTitle>
          <Form
            method="post"
            className="mt-3 grid gap-3 md:grid-cols-[2fr_1fr_2fr_auto] md:items-end"
          >
            <input type="hidden" name="intent" value="create" />
            <Field label={SABHA_EXTRA_COPY.spacesName} htmlFor="new-name">
              <Input id="new-name" name="name" required />
            </Field>
            <Field label={SABHA_EXTRA_COPY.spacesCapacity} htmlFor="new-cap">
              <Input id="new-cap" name="capacity" type="number" min={1} />
            </Field>
            <Field label={SABHA_EXTRA_COPY.spacesNotes} htmlFor="new-notes">
              <Input id="new-notes" name="notes" />
            </Field>
            <Button type="submit" pending={navigation.state === 'submitting'}>
              {SABHA_EXTRA_COPY.spacesAdd}
            </Button>
          </Form>
        </>
      ) : null}
    </>
  );
}
