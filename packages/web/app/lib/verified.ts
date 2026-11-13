/** Copy tab, "Dashboard": the Verified badge tooltip. */
export function verifiedTooltip(targetName: string): string {
  return `Managed by ${targetName} on rasika.life`;
}

/**
 * Whether a page shows the badge: only a stored `verifiedAt`, never a viewer-dependent value, so
 * the cached public page is the same for everyone. Verification is the first owner's acceptance
 * of a moderator invite, by an explicit tap, and is set by core (`acceptPartnerInvite`), which
 * `partner.acceptInvite` follows with a site cache clear.
 */
export function isVerified(record: { verifiedAt?: string | null }): boolean {
  return Boolean(record.verifiedAt);
}
