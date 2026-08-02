import type {
  CLASS_MODES,
  PROGRAM_TYPES,
  SKIP_POLICIES,
} from '@rasika/core/domain/class-program/client';
import { Button, Field, Input, PageTitle, Select } from '@rasika/ui';
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
import { createServerClient } from '~/lib/api.server';
import { requireUser } from '~/lib/auth.server';
import { pageMeta } from '~/lib/meta';

/**
 * Guru onboarding: three steps, one mutation each.
 *
 * Not one submit at the end, and not a wizard with a progress bar. Each step writes immediately,
 * so a guru who abandons after naming her classes comes back to step 2 rather than a blank slate
 * — which matters because this is a phone, in a gap between students, and something will
 * interrupt.
 *
 * Which step to show is read from the records themselves (`onboardingState`) rather than from a
 * stored flag. That makes resuming free, and it means a guru who created a program by some other
 * route is never asked to create another.
 */
export const meta = () => pageMeta('Set up your classes');

export async function loader({ request }: LoaderFunctionArgs) {
  const user = await requireUser(request);
  const trpc = await createServerClient(request);
  const state = await trpc.classes.onboardingState.query();

  // Step 0 means nothing is left to do.
  if (state.step === 0) {
    return redirect('/teaching');
  }

  return data({ user, state });
}

export async function action({ request }: ActionFunctionArgs) {
  const user = await requireUser(request);
  const formData = await request.formData();
  const trpc = await createServerClient(request);
  const step = String(formData.get('step') ?? '');

  try {
    if (step === '1') {
      await trpc.classes.createInstitution.mutate({
        name: String(formData.get('name') ?? '').trim() || user.name || 'My classes',
        timezone: String(formData.get('timezone') ?? '').trim() || undefined,
      });
      return redirect('/welcome/teaching');
    }

    if (step === '2') {
      const title = String(formData.get('title') ?? '').trim();
      await trpc.classes.createProgram.mutate({
        institutionId: String(formData.get('institutionId') ?? ''),
        // Blank is meaningful: a weekly 1:1 has no title, and the UI renders "Weekly class".
        title: title || undefined,
        type: (formData.get('type') as (typeof PROGRAM_TYPES)[number]) ?? 'regular',
        isGroup: formData.get('isGroup') === 'on',
        defaultMode: (formData.get('defaultMode') as (typeof CLASS_MODES)[number]) ?? 'in-person',
        defaultPackSize: Number(formData.get('defaultPackSize')) || undefined,
        skipPolicy: (formData.get('skipPolicy') as (typeof SKIP_POLICIES)[number]) ?? 'burn',
      });
      return redirect('/welcome/teaching');
    }

    if (step === '3') {
      // Skipping is a first-class outcome, not a back-out. A guru setting this up the evening
      // before her first class may not have the parent's email to hand.
      if (formData.get('skip') === '1') {
        return redirect('/teaching');
      }
      await trpc.classes.addLearner.mutate({
        programId: String(formData.get('programId') ?? ''),
        firstName: String(formData.get('firstName') ?? '').trim(),
        email: String(formData.get('email') ?? '').trim() || undefined,
        isMinor: formData.get('isMinor') === 'on',
        relation: formData.get('isMinor') === 'on' ? 'guardian' : 'self',
      });
      return redirect('/teaching');
    }
  } catch (error) {
    return data(
      { error: error instanceof Error ? error.message : 'Something went wrong' },
      { status: 400 }
    );
  }

  return data({ error: 'Unknown step' }, { status: 400 });
}

export default function TeachingOnboarding() {
  const { user, state } = useLoaderData<typeof loader>();
  const actionData = useActionData<typeof action>();
  const navigation = useNavigation();
  const pending = navigation.state === 'submitting';

  return (
    <Chrome headerRight={<SignOutButton />}>
      <div className="space-y-5">
        <PageTitle>Set up your classes</PageTitle>

        {actionData && 'error' in actionData && actionData.error ? (
          <p className="text-sm text-destructive" role="alert">
            {actionData.error}
          </p>
        ) : null}

        {state.step === 1 ? (
          <Form method="post" className="space-y-4">
            <input type="hidden" name="step" value="1" />
            <p className="text-sm text-muted-foreground">
              What should your students see this called?
            </p>
            <Field
              label="Name"
              htmlFor="name"
              hint="Your own name is fine. You can change it later."
            >
              <Input id="name" name="name" defaultValue={user.name} required maxLength={200} />
            </Field>
            <Button type="submit" size="wide" pending={pending}>
              Continue
            </Button>
          </Form>
        ) : null}

        {state.step === 2 && state.institution ? (
          <Form method="post" className="space-y-4">
            <input type="hidden" name="step" value="2" />
            <input type="hidden" name="institutionId" value={state.institution.id} />
            <p className="text-sm text-muted-foreground">
              Add your first class. Everything below is set to the usual answer, so a weekly
              one-to-one is just Continue.
            </p>

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
              label="Classes per payment"
              htmlFor="defaultPackSize"
              hint="What you usually sell at a time. Only a default; you can enter any number."
            >
              <Input
                id="defaultPackSize"
                name="defaultPackSize"
                type="number"
                inputMode="numeric"
                defaultValue={8}
              />
            </Field>

            <Field label="If a student misses a class" htmlFor="skipPolicy">
              <Select id="skipPolicy" name="skipPolicy" defaultValue="burn">
                <option value="burn">Count it</option>
                <option value="no-burn">Do not count it</option>
              </Select>
            </Field>

            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" name="isGroup" className="size-5" />
              More than one student attends together
            </label>

            <Button type="submit" size="wide" pending={pending}>
              Continue
            </Button>
          </Form>
        ) : null}

        {state.step === 3 && state.firstProgramId ? (
          <div className="space-y-4">
            <Form method="post" className="space-y-4">
              <input type="hidden" name="step" value="3" />
              <input type="hidden" name="programId" value={state.firstProgramId} />
              <p className="text-sm text-muted-foreground">
                Add your first student. They get access when they sign in with this address.
              </p>

              <Field label="First name" htmlFor="firstName">
                <Input id="firstName" name="firstName" required maxLength={80} />
              </Field>

              <Field
                label="Email to share with"
                htmlFor="email"
                hint="A parent's address for a child."
              >
                <Input id="email" name="email" type="email" inputMode="email" autoComplete="off" />
              </Field>

              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" name="isMinor" className="size-5" defaultChecked />
                Under 18 (a parent keeps access)
              </label>

              <Button type="submit" size="wide" pending={pending}>
                Add student
              </Button>
            </Form>

            <Form method="post">
              <input type="hidden" name="step" value="3" />
              <input type="hidden" name="skip" value="1" />
              <Button type="submit" variant="ghost" size="wide">
                Skip for now
              </Button>
            </Form>
          </div>
        ) : null}

        {/*
          Past step 1 there is no "back" to go to: the institution exists, so `/welcome` bounces
          straight through the resolver to `/teaching`. Saying Back and landing on the roster is a
          small lie, and leaving is a real thing a guru wants to do here — she can resume from
          where she stopped, since the step is read from the records rather than a progress flag.
        */}
        {state.step === 1 ? (
          <Link to="/welcome" className="block text-center text-sm text-muted-foreground underline">
            Back
          </Link>
        ) : (
          <Link
            to="/teaching"
            className="block text-center text-sm text-muted-foreground underline"
          >
            Finish this later
          </Link>
        )}
      </div>
    </Chrome>
  );
}
