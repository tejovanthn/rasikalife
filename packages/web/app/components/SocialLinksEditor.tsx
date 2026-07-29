import { SOCIAL_PLATFORM_LABELS, SocialPlatform } from '@rasika/core/domain/social-link';
import type { SocialPlatform as SocialPlatformValue } from '@rasika/core/domain/social-link';
import { Plus, X } from 'lucide-react';
import { Button } from '~/components/ui/button';
import { Input } from '~/components/ui/input';
import { Label } from '~/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '~/components/ui/select';

/**
 * A row as the editor holds it. `platform` is a bare string because a freshly added row
 * starts empty and stays that way until the moderator picks one; `readSocialLinks` is what
 * narrows it to a real platform on the way out.
 */
export type SocialLink = { platform: string; url: string };

/** A row that has been validated: exactly what the artist schema accepts. */
export type ValidSocialLink = { platform: SocialPlatformValue; url: string };

/**
 * Add and remove social links, shared by the editor draft form and the moderator wizard.
 *
 * It lives here because the two surfaces had drifted: the editor form grew this editor and
 * the wizard never did, so the moderator building profiles by hand — the person §4.3.1 says
 * this whole flow exists for — could set a website and nothing else.
 *
 * Rows submit as parallel `socialLinkPlatform` / `socialLinkUrl` fields, the same shape the
 * venue and organiser forms use, so an action reads them with two `getAll` calls and zips
 * them. Incomplete rows are the caller's to filter; leaving a half-filled row on screen is
 * better than deleting what someone is still typing.
 */
export function SocialLinksEditor({
  value,
  onChange,
}: {
  value: SocialLink[];
  onChange: (links: SocialLink[]) => void;
}) {
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <Label>Social Links</Label>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => onChange([...value, { platform: '', url: '' }])}
        >
          <Plus className="h-4 w-4" />
          Add
        </Button>
      </div>

      {value.length === 0 && (
        <p className="text-xs text-muted-foreground">No social links added.</p>
      )}

      {value.map((link, i) => (
        // biome-ignore lint/suspicious/noArrayIndexKey: rows have no id until saved, and the
        // index is what the parallel form fields are zipped by.
        <div key={i} className="flex items-center gap-2">
          <Select
            name="socialLinkPlatform"
            value={link.platform}
            onValueChange={val =>
              onChange(value.map((l, j) => (j === i ? { ...l, platform: val } : l)))
            }
          >
            <SelectTrigger className="flex-1" aria-label={`Social platform ${i + 1}`}>
              <SelectValue placeholder="Select platform..." />
            </SelectTrigger>
            <SelectContent>
              {SocialPlatform.options.map(p => (
                <SelectItem key={p} value={p}>
                  {SOCIAL_PLATFORM_LABELS[p]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Input
            name="socialLinkUrl"
            placeholder="https://..."
            type="url"
            // One row per link under the section's own Label — see DESIGN.md density rule.
            aria-label={`Social link URL ${i + 1}`}
            value={link.url}
            onChange={e =>
              onChange(value.map((l, j) => (j === i ? { ...l, url: e.target.value } : l)))
            }
            className="flex-1"
          />
          <Button
            type="button"
            variant="ghost"
            size="icon"
            aria-label={`Remove social link ${i + 1}`}
            onClick={() => onChange(value.filter((_, j) => j !== i))}
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      ))}
    </div>
  );
}

/**
 * Zip the parallel form fields back into links, dropping rows where either half is missing.
 * Shared so every action that accepts this editor agrees on what an incomplete row means.
 */
export function readSocialLinks(formData: FormData): ValidSocialLink[] {
  const platforms = formData.getAll('socialLinkPlatform') as string[];
  const urls = formData.getAll('socialLinkUrl') as string[];
  return platforms
    .map((platform, i) => ({ platform: platform.trim(), url: (urls[i] || '').trim() }))
    .filter((link): link is ValidSocialLink => {
      // Parsed, not cast. A half-filled row leaves the platform empty, and the field arrives
      // over the wire where nothing guarantees it is one of ours — so the enum decides.
      if (!link.url) return false;
      return SocialPlatform.safeParse(link.platform).success;
    });
}
