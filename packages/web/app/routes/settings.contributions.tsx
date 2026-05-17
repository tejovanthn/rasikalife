import type { ActionFunction, LoaderFunction, MetaFunction } from 'react-router';
import { Form, data, useActionData, useLoaderData, useNavigation, useOutletContext } from 'react-router';
import { createServerClient } from '~/api.server';
import { Button } from '~/components/ui/button';
import { requireUser } from '~/lib/auth.server';
import type { SettingsContext } from './settings';

export const meta: MetaFunction = () => [{ title: 'Contribution Settings - Rasika.life' }];

// Only fetch stats — preferences come from parent loader via outlet context
export const loader: LoaderFunction = async ({ request }) => {
  await requireUser(request, '/settings/contributions');
  const serverClient = await createServerClient(request);
  const stats = await serverClient.user.getMyContributionStats.query();
  return data({ stats });
};

export const action: ActionFunction = async ({ request }) => {
  await requireUser(request, '/settings/contributions');
  const serverClient = await createServerClient(request);
  const formData = await request.formData();

  await serverClient.user.updatePreferences.mutate({
    contributeToPublicSetlists: formData.get('contributeToPublicSetlists') === 'on',
    attendanceVisible: formData.get('attendanceVisible') === 'on',
  });

  return data({ success: true });
};

export default function SettingsContributions() {
  const { preferences } = useOutletContext<SettingsContext>();
  const { stats } = useLoaderData<{ stats: { eventsLogged: number; memberSince: string } }>();
  const actionData = useActionData<{ success?: boolean }>();
  const navigation = useNavigation();
  const isSaving = navigation.state === 'submitting';

  return (
    <section className="space-y-6">
      <div>
        <h2 className="text-base font-semibold">Contributions</h2>
        <p className="text-sm text-muted-foreground mt-1">
          Control how your setlist contributions are used.
        </p>
      </div>

      <div className="rounded-lg border border-border p-4 space-y-2 text-sm">
        <p className="font-medium">Your stats</p>
        <p className="text-muted-foreground">{stats.eventsLogged} concerts logged</p>
        <p className="text-muted-foreground">
          Member since{' '}
          {new Date(stats.memberSince).toLocaleDateString('en-IN', {
            year: 'numeric',
            month: 'long',
          })}
        </p>
      </div>

      <Form method="post" className="space-y-4">
        <div className="flex items-start gap-3">
          <input
            type="checkbox"
            id="contributeToPublicSetlists"
            name="contributeToPublicSetlists"
            defaultChecked={preferences.contributeToPublicSetlists}
            className="h-4 w-4 rounded border-input mt-0.5"
          />
          <div>
            <label htmlFor="contributeToPublicSetlists" className="text-sm font-medium">
              Contribute to public setlists
            </label>
            <p className="text-xs text-muted-foreground">
              Your setlist entries will be used to build the public setlist for events
            </p>
          </div>
        </div>

        <div className="flex items-start gap-3">
          <input
            type="checkbox"
            id="attendanceVisible"
            name="attendanceVisible"
            defaultChecked={preferences.attendanceVisible}
            className="h-4 w-4 rounded border-input mt-0.5"
          />
          <div>
            <label htmlFor="attendanceVisible" className="text-sm font-medium">
              Make attendance visible
            </label>
            <p className="text-xs text-muted-foreground">
              Show which concerts you've attended on your public profile
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <Button type="submit" disabled={isSaving}>
            {isSaving ? 'Saving…' : 'Save preferences'}
          </Button>
          {actionData?.success && !isSaving && (
            <span className="text-sm text-success">Saved</span>
          )}
        </div>
      </Form>
    </section>
  );
}
