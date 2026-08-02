import {
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  PageTitle,
  buttonVariants,
} from '@rasika/ui';
import type { LoaderFunctionArgs } from 'react-router';
import { Link, data, redirect, useLoaderData } from 'react-router';
import { Chrome, SignOutButton } from '~/components/chrome';
import { createServerClient } from '~/lib/api.server';
import { requireUser } from '~/lib/auth.server';
import { contextCount } from '~/lib/context';
import { pageMeta } from '~/lib/meta';

export const meta = () => pageMeta('Welcome');

export async function loader({ request }: LoaderFunctionArgs) {
  const user = await requireUser(request);
  const trpc = await createServerClient(request);
  const contexts = await trpc.classes.getMyContexts.query();

  // Someone who already has a context has no business here — an invite claimed on this very
  // sign-in is the common way to arrive with one. Back to the resolver, which knows where to go.
  if (contextCount(contexts) > 0) {
    return redirect('/');
  }

  return data({ user });
}

export default function Welcome() {
  const { user } = useLoaderData<typeof loader>();

  return (
    <Chrome headerRight={<SignOutButton />}>
      <div className="space-y-6">
        <PageTitle>Welcome</PageTitle>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">I teach classes</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-sm text-muted-foreground">
              Keep a shared record of who has paid for how many classes, and which ones have
              happened.
            </p>
            <Link to="/welcome/teaching" className={buttonVariants({ size: 'wide' })}>
              Set up my classes
            </Link>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">I take classes</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {/*
              A dead end on purpose. §A4: a learner may not create their own record. A
              `classLearner` with no institution has no guru to confirm sessions and no source of
              credits — it is an orphan row somebody would later have to merge against the real
              one, and there is no merge tooling for class entities.

              So the useful thing is the address, shown verbatim so it can be forwarded. A guru
              typing it slightly differently still works: the invite lookup normalises Gmail dots
              and tags.
            */}
            <p className="text-sm text-muted-foreground">
              Ask your guru to invite you at this address:
            </p>
            <p className="break-all rounded-md bg-muted px-3 py-2 font-mono text-sm">
              {user.email}
            </p>
            <p className="text-sm text-muted-foreground">
              Your classes appear here the next time you open the app after they do.
            </p>
          </CardContent>
        </Card>
      </div>
    </Chrome>
  );
}
