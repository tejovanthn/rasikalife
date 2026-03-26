import { z } from 'zod';

export const SocialPlatform = z.enum([
  'youtube',
  'instagram',
  'facebook',
  'twitter',
  'spotify',
  'apple_music',
  'soundcloud',
  'website',
  'wikipedia',
]);

export type SocialPlatform = z.infer<typeof SocialPlatform>;

export const SOCIAL_PLATFORM_LABELS: Record<SocialPlatform, string> = {
  youtube: 'YouTube',
  instagram: 'Instagram',
  facebook: 'Facebook',
  twitter: 'Twitter / X',
  spotify: 'Spotify',
  apple_music: 'Apple Music',
  soundcloud: 'SoundCloud',
  website: 'Website',
  wikipedia: 'Wikipedia',
};

export const SocialLinkSchema = z.object({
  platform: SocialPlatform,
  url: z.string().url(),
});

export type SocialLink = z.infer<typeof SocialLinkSchema>;
