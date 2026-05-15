import type { ActionFunction, MetaFunction } from 'react-router';
import { Form, data, useActionData, useNavigation, useOutletContext } from 'react-router';
import { createServerClient } from '~/api.server';
import { Button } from '~/components/ui/button';
import { requireUser } from '~/lib/auth.server';
import type { SettingsContext } from './settings';

export const meta: MetaFunction = () => [{ title: 'Display Settings - Rasika.life' }];

export const action: ActionFunction = async ({ request }) => {
  await requireUser(request, '/settings/display');
  const serverClient = await createServerClient(request);
  const formData = await request.formData();

  await serverClient.user.updatePreferences.mutate({
    theme: formData.get('theme') as 'system' | 'light' | 'dark',
    contentLanguage: formData.get('contentLanguage') as
      | 'english'
      | 'tamil'
      | 'telugu'
      | 'kannada'
      | 'hindi'
      | 'devanagari'
      | 'sanskrit',
  });

  return data({ success: true });
};

const THEME_OPTIONS = [
  { value: 'system', label: 'System' },
  { value: 'light', label: 'Light' },
  { value: 'dark', label: 'Dark' },
] as const;

const LANGUAGE_OPTIONS = [
  { value: 'english', label: 'English (IAST)' },
  { value: 'tamil', label: 'தமிழ்' },
  { value: 'telugu', label: 'తెలుగు' },
  { value: 'kannada', label: 'ಕನ್ನಡ' },
  { value: 'hindi', label: 'हिंदी' },
  { value: 'devanagari', label: 'देवनागरी (Sanskrit)' },
  { value: 'sanskrit', label: 'Sanskrit (IAST)' },
] as const;

export default function SettingsDisplay() {
  const { preferences } = useOutletContext<SettingsContext>();
  const actionData = useActionData<{ success?: boolean }>();
  const navigation = useNavigation();
  const isSaving = navigation.state === 'submitting';

  return (
    <section className="space-y-6">
      <div>
        <h2 className="text-base font-semibold">Display</h2>
        <p className="text-sm text-muted-foreground mt-1">
          Theme and content language preferences.
        </p>
      </div>

      <Form method="post" className="space-y-6">
        <div>
          <label className="text-sm font-medium block mb-2">Theme</label>
          <div className="flex gap-3">
            {THEME_OPTIONS.map(opt => (
              <label key={opt.value} className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  name="theme"
                  value={opt.value}
                  defaultChecked={preferences.theme === opt.value}
                  className="h-4 w-4"
                />
                <span className="text-sm">{opt.label}</span>
              </label>
            ))}
          </div>
        </div>

        <div>
          <label htmlFor="contentLanguage" className="text-sm font-medium block mb-1">
            Content display language
          </label>
          <p className="text-xs text-muted-foreground mb-2">
            Controls which script composition titles, raga names, and lyrics are displayed in.
          </p>
          <select
            id="contentLanguage"
            name="contentLanguage"
            defaultValue={preferences.contentLanguage}
            className="w-full px-3 py-2 text-sm rounded-md border border-input bg-background focus:outline-none focus:ring-2 focus:ring-ring"
          >
            {LANGUAGE_OPTIONS.map(opt => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>

        <div className="flex items-center gap-3">
          <Button type="submit" disabled={isSaving}>
            {isSaving ? 'Saving…' : 'Save display preferences'}
          </Button>
          {actionData?.success && !isSaving && (
            <span className="text-sm text-green-600">Saved</span>
          )}
        </div>
      </Form>
    </section>
  );
}
