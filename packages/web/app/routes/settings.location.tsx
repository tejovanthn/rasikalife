import type { ActionFunctionArgs, LoaderFunctionArgs, MetaFunction } from 'react-router';
import { Form, data, redirect, useActionData, useLoaderData } from 'react-router';
import { createServerClient } from '~/api.server';
import { HOME_LOCATION_ERRORS, HomeLocationForm } from '~/components/events/home-location-form';
import { Button } from '~/components/ui/button';
import { requireUser } from '~/lib/auth.server';
import { safeRedirectPath } from '~/lib/safe-redirect';

export const meta: MetaFunction = () => [{ title: 'Location Settings - Rasika.life' }];

export const loader = async ({ request }: LoaderFunctionArgs) => {
  await requireUser(request, '/settings/location');
  const serverClient = await createServerClient(request);
  return data({ home: await serverClient.user.getHomeLocation.query() });
};

export const action = async ({ request }: ActionFunctionArgs) => {
  const form = await request.formData();
  const back = safeRedirectPath(form.get('redirectTo'));
  await requireUser(request, back ?? '/settings/location');
  const serverClient = await createServerClient(request);
  const intent = form.get('intent');

  if (intent === 'clear') {
    await serverClient.user.clearHomeLocation.mutate();
    return redirect(back ?? '/settings/location');
  }

  const result =
    intent === 'device'
      ? await serverClient.user.setHomeLocation.mutate({
          lat: Number(form.get('lat')),
          lng: Number(form.get('lng')),
        })
      : await serverClient.user.setHomeLocation.mutate({ pin: String(form.get('pin') ?? '') });

  if (!result.ok) {
    return data({ error: HOME_LOCATION_ERRORS[result.reason] }, { status: 400 });
  }
  return redirect(back ?? '/settings/location');
};

export default function SettingsLocation() {
  const { home } = useLoaderData<typeof loader>();
  const actionData = useActionData<typeof action>();

  return (
    <section className="space-y-6">
      <div>
        <h2 className="text-base font-semibold">Location</h2>
        <p className="text-sm text-muted-foreground mt-1">
          The event listings show how far each concert is from here. We keep a PIN code, or your
          location rounded to about a kilometre, and nothing more precise.
        </p>
      </div>

      {home ? (
        <div className="space-y-3">
          <p className="text-sm">
            Distances are measured from{' '}
            <strong>{home.pin ? `PIN ${home.pin}` : 'your location (to about 1 km)'}</strong>.
          </p>
          <Form method="post">
            <input type="hidden" name="intent" value="clear" />
            <Button type="submit" variant="outline" className="min-h-11 md:min-h-10">
              Remove my location
            </Button>
          </Form>
          <p className="text-sm text-muted-foreground">Or set a new one:</p>
        </div>
      ) : null}

      <HomeLocationForm
        redirectTo="/settings/location"
        error={actionData && 'error' in actionData ? actionData.error : undefined}
      />
    </section>
  );
}
