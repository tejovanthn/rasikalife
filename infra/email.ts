import { getDomain } from './domain';

/**
 * The transactional sender, verified on the **`classes` subdomain** rather than the root.
 *
 * Email reputation at the large mailbox providers is tracked per domain — the From domain and the
 * DKIM `d=` domain — not per local-part, so `noreply@` and a future `marketing@` on one domain
 * would share a single reputation. That matters more than it sounds: this configuration set
 * inherits the **account-level suppression list**, which SES populates from complaints. One
 * recipient marking a marketing email as spam would suppress that address account-wide, and the
 * next "you've been added to a class" to the same family would be dropped rather than refused —
 * no error to catch, no signal anywhere.
 *
 * So the rule is that a marketing stream never sends from here. It gets its own subdomain
 * (`news.`, say) and therefore its own identity, configuration set and reputation. Nothing
 * provisions one today because nothing sends marketing today.
 *
 * Verifying the subdomain also puts DMARC at `_dmarc.classes.rasika.life`, clear of the root
 * domain that already serves the live site.
 */
const { name: sender, dns } = getDomain('classes');

export const email = new sst.aws.Email('Email', {
  sender,
  dns,
});
