import { NavLink, Outlet, data, useLoaderData } from 'react-router';
import type { LoaderFunction, MetaFunction } from 'react-router';
import { createServerClient } from '~/api.server';
import { requireUser } from '~/lib/auth.server';
import { cn } from '~/lib/utils';

export const meta: MetaFunction = () => [
  { title: 'Settings - Rasika.life' },
  { name: 'robots', content: 'noindex, nofollow' },
];

export const loader: LoaderFunction = async ({ request }) => {
  const user = await requireUser(request, '/settings');
  const serverClient = await createServerClient(request);
  const preferences = await serverClient.user.getMyPreferences.query();
  return data({ user, preferences });
};

const NAV_ITEMS = [
  { to: '/settings/profile', label: 'Profile' },
  { to: '/settings/contributions', label: 'Contributions' },
  { to: '/settings/display', label: 'Display' },
  { to: '/settings/account', label: 'Account' },
];

export type SettingsContext = {
  user: { id: string; email: string; name: string; createdAt: string };
  preferences: {
    theme: string;
    contentLanguage: string;
    contributeToPublicSetlists: boolean;
    attendanceVisible: boolean;
    showProfilePublicly: boolean;
    displayName: string;
    bio: string;
  };
};

export default function SettingsLayout() {
  const context = useLoaderData<SettingsContext>();

  return (
    <div className="container mx-auto px-4 py-8 max-w-3xl">
      <h1 className="text-2xl font-bold mb-6">Settings</h1>

      <div className="flex flex-col sm:flex-row gap-8">
        <nav className="sm:w-48 shrink-0">
          <ul className="space-y-1">
            {NAV_ITEMS.map(item => (
              <li key={item.to}>
                <NavLink
                  to={item.to}
                  className={({ isActive }) =>
                    cn(
                      'block px-3 py-2 rounded-md text-sm transition-colors',
                      isActive
                        ? 'bg-muted font-medium'
                        : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'
                    )
                  }
                >
                  {item.label}
                </NavLink>
              </li>
            ))}
          </ul>
        </nav>

        <main className="flex-1 min-w-0">
          <Outlet context={context} />
        </main>
      </div>
    </div>
  );
}
