import type { ActionFunction, MetaFunction } from 'react-router';
import { Form, useOutletContext } from 'react-router';
import { Button } from '~/components/ui/button';
import { logout } from '~/lib/auth.server';
import type { SettingsContext } from './settings';

export const meta: MetaFunction = () => [{ title: 'Account Settings - Rasika.life' }];

export const action: ActionFunction = async ({ request }) => logout(request);

export default function SettingsAccount() {
  const { user } = useOutletContext<SettingsContext>();

  return (
    <section className="space-y-6">
      <div>
        <h2 className="text-base font-semibold">Account</h2>
        <p className="text-sm text-muted-foreground mt-1">Your account details.</p>
      </div>

      <div className="space-y-3 text-sm">
        <div>
          <p className="text-xs text-muted-foreground">Email</p>
          <p className="font-medium">{user.email}</p>
        </div>
        <div>
          <p className="text-xs text-muted-foreground">Member since</p>
          <p className="font-medium">
            {new Date(user.createdAt).toLocaleDateString('en-IN', {
              year: 'numeric',
              month: 'long',
              day: 'numeric',
            })}
          </p>
        </div>
        <div>
          <p className="text-xs text-muted-foreground">Connected accounts</p>
          <p className="font-medium">Google</p>
        </div>
      </div>

      <Form method="post">
        <Button type="submit" variant="outline">
          Sign out
        </Button>
      </Form>
    </section>
  );
}
