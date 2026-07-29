import { SOCIAL_PLATFORM_LABELS } from '@rasika/core/domain/social-link';
import {
  AudioLines,
  BookOpen,
  Disc3,
  Facebook,
  Globe,
  Instagram,
  type LucideIcon,
  Music,
  Twitter,
  Youtube,
} from 'lucide-react';

/**
 * One glyph per platform.
 *
 * Only four of these are real brand marks: lucide dropped the rest, so Spotify, Apple Music,
 * SoundCloud, Wikipedia and a plain website get an evocative generic instead — a disc, a
 * musical note, a waveform, a book, a globe. They are at least all *distinct*, which matters
 * more than fidelity here: three identical music notes in a row would leave a reader unable
 * to tell one service from another without hovering, and DESIGN.md rules out putting anything
 * that matters behind hover.
 */
const PLATFORM_ICONS: Record<string, LucideIcon> = {
  youtube: Youtube,
  instagram: Instagram,
  facebook: Facebook,
  twitter: Twitter,
  spotify: Disc3,
  apple_music: Music,
  soundcloud: AudioLines,
  website: Globe,
  wikipedia: BookOpen,
};

/**
 * An icon-only link to an artist's presence somewhere else.
 *
 * Three things make icon-only safe rather than merely compact:
 *
 * - The icon is `aria-hidden` and the name is carried in `sr-only` text. An `aria-label` on a
 *   bare `<svg>` is not reliably announced, which is the same defect the audit found on the
 *   verified badge.
 * - `title` gives sighted desktop users the name on hover, since the glyph alone cannot say
 *   "Apple Music" rather than "Spotify".
 * - The tap target is 44px, which DESIGN.md asks of anything a phone user taps. An unpadded
 *   20px icon would be a third of that.
 *
 * `no-ext-arrow` matters: globals.css appends "↗" to every external link, which would sit
 * beside the glyph and undo the point of an icon.
 */
export function SocialIconLink({ platform, url }: { platform: string; url: string }) {
  const Icon = PLATFORM_ICONS[platform] ?? Globe;
  const label = SOCIAL_PLATFORM_LABELS[platform as keyof typeof SOCIAL_PLATFORM_LABELS] ?? platform;

  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      title={label}
      className="no-ext-arrow inline-flex h-11 w-11 items-center justify-center rounded-md text-primary transition-colors hover:bg-accent"
    >
      <Icon aria-hidden="true" className="h-5 w-5" />
      <span className="sr-only">{label}</span>
    </a>
  );
}
