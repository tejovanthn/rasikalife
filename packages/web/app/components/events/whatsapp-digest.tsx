import { Check, Copy, MessageCircle, Share2 } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Link } from 'react-router';
import { Button, buttonVariants } from '~/components/ui/button';
import { AnalyticsEvent, trackEvent } from '~/lib/analytics';
import { cn } from '~/lib/utils';
import { whatsAppOpenLink } from '~/lib/whatsapp-digest';

/**
 * The listing as text for a WhatsApp group. "Open in WhatsApp" is a plain `wa.me` link and
 * the options are links, so all of it works without JavaScript; Copy and Share need it and
 * appear after hydration.
 */
export function WhatsAppDigest({
  text,
  options,
}: {
  text: string;
  /** Each option is a link to the same listing with that option flipped. */
  options: Array<{ label: string; on: boolean; href: string }>;
}) {
  // A very long `wa.me` link opens WhatsApp empty on some phones, so a long text opens with
  // fewer concerts, or not at all, and Copy carries the whole of it.
  const open = whatsAppOpenLink(text);
  const [copied, setCopied] = useState(false);
  const [canShare, setCanShare] = useState(false);
  const [canCopy, setCanCopy] = useState(false);

  useEffect(() => {
    setCanShare(typeof navigator.share === 'function');
    setCanCopy(Boolean(navigator.clipboard));
  }, []);

  async function copy() {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      trackEvent(AnalyticsEvent.WHATSAPP_DIGEST, { method: 'copy' });
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      setCanCopy(false);
    }
  }

  async function share() {
    try {
      await navigator.share({ text });
      trackEvent(AnalyticsEvent.WHATSAPP_DIGEST, { method: 'share' });
    } catch {
      // Dismissed by the reader.
    }
  }

  return (
    <section aria-labelledby="whatsapp-digest-heading" className="space-y-4">
      <h2 id="whatsapp-digest-heading" className="sr-only">
        Text for WhatsApp
      </h2>
      <p className="text-sm text-muted-foreground">
        Paste this into a group: the concerts below as plain text, with a link back here.
      </p>
      <div className="flex flex-wrap gap-2">
        {/* Rendered from the start and enabled once the page can reach the clipboard, so the
            row does not jump on hydration. Share is last, so its late arrival moves nothing. */}
        <Button type="button" onClick={copy} disabled={!canCopy} className="min-h-11 md:min-h-10">
          {copied ? (
            <Check className="mr-2 h-4 w-4" aria-hidden="true" />
          ) : (
            <Copy className="mr-2 h-4 w-4" aria-hidden="true" />
          )}
          <span aria-live="polite">{copied ? 'Copied' : 'Copy text'}</span>
        </Button>
        {open && (
          <a
            href={open.url}
            target="_blank"
            rel="noopener noreferrer"
            onClick={() => trackEvent(AnalyticsEvent.WHATSAPP_DIGEST, { method: 'open' })}
            className={cn(
              buttonVariants({ variant: 'outline' }),
              'min-h-11 md:min-h-10 no-underline'
            )}
          >
            <MessageCircle className="mr-2 h-4 w-4" aria-hidden="true" />
            Open in WhatsApp
          </a>
        )}
        {canShare && (
          <Button type="button" variant="outline" onClick={share} className="min-h-11 md:min-h-10">
            <Share2 className="mr-2 h-4 w-4" aria-hidden="true" />
            Share
          </Button>
        )}
      </div>
      {open?.shortened && (
        <p className="text-sm text-muted-foreground">
          This list is long, so WhatsApp opens with the first concerts only. Copy text has all of
          them.
        </p>
      )}
      {!open && (
        <p className="text-sm text-muted-foreground">
          This list is too long to open in WhatsApp directly. Use Copy text instead.
        </p>
      )}

      <fieldset className="flex flex-wrap gap-x-4 gap-y-1">
        <legend className="sr-only">Include</legend>
        {options.map(option => (
          <Link
            key={option.label}
            to={option.href}
            replace
            preventScrollReset
            className="inline-flex items-center gap-2 text-sm min-h-11 md:min-h-9 no-underline text-foreground"
          >
            <span
              aria-hidden="true"
              className={cn(
                'flex h-4 w-4 items-center justify-center rounded-sm border border-primary',
                option.on && 'bg-primary text-primary-foreground'
              )}
            >
              {option.on && <Check className="h-3 w-3" />}
            </span>
            {option.label}
            <span className="sr-only">{option.on ? ' (on)' : ' (off)'}</span>
          </Link>
        ))}
      </fieldset>

      <pre className="whitespace-pre-wrap break-words rounded-lg border bg-card p-4 text-sm font-sans leading-relaxed">
        {text}
      </pre>
    </section>
  );
}
