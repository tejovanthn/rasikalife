import type { ActionFunction, MetaFunction } from 'react-router';
import { Form, data, useActionData, useNavigation, useOutletContext } from 'react-router';
import { createServerClient } from '~/api.server';
import { Button } from '~/components/ui/button';
import { requireUser } from '~/lib/auth.server';
import type { SettingsContext } from './settings';

export const meta: MetaFunction = () => [{ title: 'Profile Settings - Rasika.life' }];

export const action: ActionFunction = async ({ request }) => {
  await requireUser(request, '/settings/profile');
  const serverClient = await createServerClient(request);
  const formData = await request.formData();

  await serverClient.user.updatePreferences.mutate({
    displayName: (formData.get('displayName') as string).trim() || undefined,
    bio: (formData.get('bio') as string).trim() || undefined,
    showProfilePublicly: formData.get('showProfilePublicly') === 'on',
  });

  return data({ success: true });
};

export default function SettingsProfile() {
  const { preferences } = useOutletContext<SettingsContext>();
  const actionData = useActionData<{ success?: boolean }>();
  const navigation = useNavigation();
  const isSaving = navigation.state === 'submitting';

  return (
    <section className="space-y-6">
      <div>
        <h2 className="text-base font-semibold">Profile</h2>
        <p className="text-sm text-muted-foreground mt-1">Your public presence on Rasika.life.</p>
      </div>

      <Form method="post" className="space-y-4">
        <div>
          <label htmlFor="displayName" className="text-sm font-medium block mb-1">
            Display name
          </label>
          <input
            type="text"
            id="displayName"
            name="displayName"
            defaultValue={preferences.displayName}
            maxLength={100}
            placeholder="Your name as it appears publicly"
            className="w-full px-3 py-2 text-sm rounded-md border border-input bg-background focus:outline-none focus:ring-2 focus:ring-ring"
          />
        </div>

        <div>
          <label htmlFor="bio" className="text-sm font-medium block mb-1">
            Bio
          </label>
          <textarea
            id="bio"
            name="bio"
            defaultValue={preferences.bio}
            maxLength={500}
            rows={3}
            placeholder="A short description about yourself (optional)"
            className="w-full px-3 py-2 text-sm rounded-md border border-input bg-background focus:outline-none focus:ring-2 focus:ring-ring resize-y"
          />
        </div>

        <div className="flex items-center gap-3">
          <input
            type="checkbox"
            id="showProfilePublicly"
            name="showProfilePublicly"
            defaultChecked={preferences.showProfilePublicly}
            className="h-4 w-4 rounded border-input"
          />
          <div>
            <label htmlFor="showProfilePublicly" className="text-sm font-medium">
              Show public profile
            </label>
            <p className="text-xs text-muted-foreground">
              Allow others to view your profile at /u/username
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <Button type="submit" disabled={isSaving}>
            {isSaving ? 'Saving…' : 'Save profile'}
          </Button>
          {actionData?.success && !isSaving && (
            <span className="text-sm text-green-600">Saved</span>
          )}
        </div>
      </Form>
    </section>
  );
}
