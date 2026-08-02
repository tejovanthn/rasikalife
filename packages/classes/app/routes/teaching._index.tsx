import {
  type CLASS_MODES,
  type PROGRAM_TYPES,
  type SKIP_POLICIES,
  programDisplayTitle,
} from '@rasika/core/domain/class-program/client';
import {
  Badge,
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  EmptyState,
  Field,
  Input,
  PageTitle,
  Select,
  buttonVariants,
} from '@rasika/ui';
import type { ActionFunctionArgs, LoaderFunctionArgs } from 'react-router';
import {
  Form,
  Link,
  data,
  redirect,
  useActionData,
  useLoaderData,
  useNavigation,
} from 'react-router';
import { Chrome, SignOutButton } from '~/components/chrome';
import { ContextSwitcher } from '~/components/context-switcher';
import { createServerClient } from '~/lib/api.server';
import { requireUserId } from '~/lib/auth.server';
import { pageMeta } from '~/lib/meta';

export const meta = () => pageMeta('Students');

export async function loader({ request }: LoaderFunctionArgs) {
  await requireUserId(request);
  const trpc = await createServerClient(request);
  const url = new URL(request.url);
  const includeArchived = url.searchParams.get('archived') === '1';

  const contexts = await trpc.classes.getMyContexts.query();
  const teaching = contexts.teaching[0] ?? null;

  // Not a teacher. Onboarding lives at /welcome and nowhere else, so this hands them back to the
  // resolver rather than growing a second front door that could drift from the first.
  if (!teaching) {
    return redirect('/');
  }

  const programs = await trpc.classes.programs.query({
    institutionId: teaching.institutionId,
    includeArchived,
  });

  return data({ contexts, teaching, programs, includeArchived });
}

export async function action({ request }: ActionFunctionArgs) {
  await requireUserId(request);
  const formData = await request.formData();
  const trpc = await createServerClient(request);
  const intent = String(formData.get('intent') ?? '');

  try {
    if (intent === 'create-program') {
      const institutionId = String(formData.get('institutionId') ?? '');
      const title = String(formData.get('title') ?? '').trim();
      const program = await trpc.classes.createProgram.mutate({
        institutionId,
        // A weekly 1:1 has no title on purpose — asking a guru to name her Tuesday lesson is
        // asking her to invent something. The blank is meaningful, so it is not sent.
        title: title || undefined,
        type: (formData.get('type') as (typeof PROGRAM_TYPES)[number]) ?? 'regular',
        isGroup: formData.get('isGroup') === 'on',
        defaultMode: (formData.get('defaultMode') as (typeof CLASS_MODES)[number]) ?? 'in-person',
        skipPolicy: (formData.get('skipPolicy') as (typeof SKIP_POLICIES)[number]) ?? 'burn',
      });
      return redirect(`/teaching/${program.id}`);
    }

    if (intent === 'archive') {
      await trpc.classes.archiveProgram.mutate({
        programId: String(formData.get('programId') ?? ''),
        archived: formData.get('archived') === '1',
      });
      return redirect('/teaching');
    }
  } catch (error) {
    return data(
      { error: error instanceof Error ? error.message : 'Something went wrong' },
      { status: 400 }
    );
  }

  return data({ error: 'Unknown action' }, { status: 400 });
}

export default function Roster() {
  const { contexts, teaching, programs, includeArchived } = useLoaderData<typeof loader>();
  const actionData = useActionData<typeof action>();
  const navigation = useNavigation();
  const institution = { id: teaching.institutionId };

  return (
    <Chrome
      isTeacher
      isLearner={contexts.learners.length > 0}
      headerRight={
        <div className="flex items-center gap-2">
          <ContextSwitcher
            contexts={contexts}
            current={{ kind: 'teaching', institutionId: teaching.institutionId }}
          />
          <SignOutButton />
        </div>
      }
    >
      <div className="space-y-5">
        {/*
          Tiles, not cards. A class is a thing you open — the per-class settings that used to be
          spelled out under each name (weekly · in person · missed classes are counted) belong on
          the class itself, where they are edited, not repeated down a list you are scanning to
          find one name.
        */}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <PageTitle>Classes</PageTitle>
          <a href="#add-class" className={buttonVariants({ variant: 'outline' })}>
            + Add class
          </a>
        </div>

        {actionData && 'error' in actionData && actionData.error ? (
          <p className="text-sm text-destructive" role="alert">
            {actionData.error}
          </p>
        ) : null}

        {/*
          §A5: an institution with zero programs, reachable by abandoning onboarding at step 2.
          The roster must not render blank — the thing to do next is right here.
        */}
        {programs.length === 0 ? (
          <EmptyState title="No classes set up yet">
            Add your first class below. A weekly one-to-one needs no name.
          </EmptyState>
        ) : (
          <ul className="flex flex-wrap gap-3">
            {programs.map(program => (
              <li key={program.id}>
                {/* The whole tile is the link. A single "Open" button inside a card meant two
                    targets for one intent, and the smaller of them was the real one. */}
                <Link
                  to={`/teaching/${program.id}`}
                  className="flex min-h-tap min-w-[12rem] flex-col justify-between gap-2 rounded-lg border border-border bg-card p-4 text-card-foreground no-underline hover:border-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  {/* A heading inside the anchor: the whole tile stays one target, and a screen
                      reader can still navigate the list by heading the way it could when these
                      were cards. */}
                  <h2 className="font-semibold leading-tight">{programDisplayTitle(program)}</h2>
                  <span className="flex flex-wrap items-center gap-2">
                    {program.isGroup ? <Badge>Group</Badge> : null}
                    {program.archivedAt ? <Badge tone="neutral">Archived</Badge> : null}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}

        <Form method="get">
          <input type="hidden" name="archived" value={includeArchived ? '0' : '1'} />
          <Button type="submit" variant="ghost">
            {includeArchived ? 'Hide archived' : 'Show archived'}
          </Button>
        </Form>

        <details className="rounded-lg border border-border p-4">
          {/* `<details>` rather than a state toggle, so the form is reachable before hydration
              and the page does not open with a wall of inputs. */}
          <summary className="min-h-tap cursor-pointer font-medium">Add a class</summary>
          {/* The id lives on the form, not on the `<details>`. A fragment pointing at a closed
              `<details>` scrolls to it and leaves it shut — the browser only auto-expands when the
              target is a *descendant*. Both behaviours confirmed in a browser. */}
          <Form id="add-class" method="post" className="mt-4 space-y-4">
            <input type="hidden" name="intent" value="create-program" />
            <input type="hidden" name="institutionId" value={institution.id} />

            <Field label="Name" htmlFor="title" hint="Leave blank for an ordinary weekly class.">
              <Input id="title" name="title" placeholder="e.g. Tyagaraja intensive" />
            </Field>

            <Field label="Kind" htmlFor="type">
              <Select id="type" name="type" defaultValue="regular">
                <option value="regular">Weekly class</option>
                <option value="workshop">Workshop</option>
              </Select>
            </Field>

            <Field label="Usually held" htmlFor="defaultMode">
              <Select id="defaultMode" name="defaultMode" defaultValue="in-person">
                <option value="in-person">In person</option>
                <option value="online">Online</option>
              </Select>
            </Field>

            <Field
              label="If a student misses a class"
              htmlFor="skipPolicy"
              hint="Most gurus count it. You can change this per class later."
            >
              <Select id="skipPolicy" name="skipPolicy" defaultValue="burn">
                <option value="burn">Count it</option>
                <option value="no-burn">Do not count it</option>
              </Select>
            </Field>

            <label className="flex min-h-tap items-center gap-3 text-sm">
              <input type="checkbox" name="isGroup" className="size-6" />
              More than one student attends together
            </label>

            <Button type="submit" size="wide" pending={navigation.state === 'submitting'}>
              Add class
            </Button>
          </Form>
        </details>
      </div>
    </Chrome>
  );
}
