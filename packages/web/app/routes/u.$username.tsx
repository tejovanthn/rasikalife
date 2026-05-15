import type { LoaderFunction, MetaFunction } from 'react-router';
import { data, useLoaderData } from 'react-router';
import { createServerClient } from '~/api.server';

export const meta: MetaFunction = ({ data }) => {
  const d = data as { displayName?: string } | null;
  return [
    { title: d?.displayName ? `${d.displayName} - Rasika.life` : 'Profile - Rasika.life' },
  ];
};

export const loader: LoaderFunction = async ({ request, params }) => {
  const { username } = params;
  if (!username) throw new Response('Not found', { status: 404 });

  const serverClient = await createServerClient(request);
  const profile = await serverClient.user.getPublicProfile.query({ username });

  if (!profile) throw new Response('Profile not found', { status: 404 });

  return data({ profile });
};

export default function UserProfile() {
  const { profile } = useLoaderData<{
    profile: {
      id: string;
      displayName: string;
      bio?: string;
      createdAt: string;
    };
  }>();

  return (
    <main className="container mx-auto px-4 py-8 max-w-2xl">
      <div className="mb-6">
        <h1 className="text-2xl font-bold">{profile.displayName}</h1>
        {profile.bio && (
          <p className="text-muted-foreground mt-2 text-sm">{profile.bio}</p>
        )}
        <p className="text-xs text-muted-foreground mt-2">
          Member since{' '}
          {new Date(profile.createdAt).toLocaleDateString('en-IN', {
            year: 'numeric',
            month: 'long',
          })}
        </p>
      </div>
    </main>
  );
}
