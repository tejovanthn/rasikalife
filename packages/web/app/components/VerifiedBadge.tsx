import { BadgeCheck } from 'lucide-react';
import { Badge } from '~/components/ui/badge';
import { verifiedTooltip } from '~/lib/verified';

/**
 * "Verified", shown on an organiser or venue page once a moderator's invite was accepted by an
 * owner (`verifiedAt`). The caller renders it only when `verifiedAt` is stored, and that value
 * comes from the record, so it is the same for every reader and safe on a cached page.
 * Strings are from the Copy tab: the badge reads "Verified", the tooltip "Managed by {name} on
 * rasika.life".
 */
export function VerifiedBadge({ name }: { name: string }) {
  return (
    <Badge variant="success" title={verifiedTooltip(name)} className="gap-1">
      <BadgeCheck className="h-3.5 w-3.5" aria-hidden="true" />
      Verified
    </Badge>
  );
}
