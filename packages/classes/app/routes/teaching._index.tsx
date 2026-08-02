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
import { requireUser } from '~/lib/auth.server';
import { pageMeta } from '~/lib/meta';

export const meta = () => pageMeta('Students');

export async function loader({ request }: LoaderFunctionArgs) {
  await requireUser(request);
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
  await requireUser(request);
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
        <PageTitle>Students</PageTitle>

        {actionData && 'error' in actionData && actionData.error ? (
          <p className="text-sm text-destructive" role="alert">
            {actionData.error}
          </p>
        ) : null}

        {/*
          §A5: an institution with zero programs, reachable by abandoning onboarding at step 2.
          The roster must not render blank — the thing to do next is right here, so this points at
          the form below rather than sending them back through /welcome, which would refuse them
          anyway now that they have an institution.
        */}
        {programs.length === 0 ? (
          <EmptyState title="No classes set up yet">
            Add your first class below. A weekly one-to-one needs no name.
          </EmptyState>
        ) : (
          <ul className="space-y-3">
            {programs.map(program => (
              <li key={program.id}>
                <Card>
                  <CardHeader className="pb-2">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <CardTitle className="text-base">{programDisplayTitle(program)}</CardTitle>
                      <div className="flex items-center gap-2">
                        {program.isGroup ? <Badge>Group</Badge> : null}
                        {program.archivedAt ? <Badge tone="neutral">Archived</Badge> : null}
                      </div>
                    </div>
                    <p className="text-sm text-muted-foreground">
                      {program.type === 'workshop' ? 'Workshop' : 'Weekly'} ·{' '}
                      {program.defaultMode === 'online' ? 'Online' : 'In person'} ·{' '}
                      {program.skipPolicy === 'burn'
                        ? 'missed classes are counted'
                        : 'missed classes are not counted'}
                    </p>
                  </CardHeader>
                  <CardContent className="flex flex-wrap gap-2">
                    <Link
                      to={`/teaching/${program.id}`}
                      className={buttonVariants({ variant: 'outline' })}
                    >
                      Open
                    </Link>
                    <Form method="post">
                      <input type="hidden" name="intent" value="archive" />
                      <input type="hidden" name="programId" value={program.id} />
                      <input type="hidden" name="archived" value={program.archivedAt ? '0' : '1'} />
                      <Button type="submit" variant="ghost">
                        {program.archivedAt ? 'Unarchive' : 'Archive'}
                      </Button>
                    </Form>
                  </CardContent>
                </Card>
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
          <Form method="post" className="mt-4 space-y-4">
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

            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" name="isGroup" className="size-5" />
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
