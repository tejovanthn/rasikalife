import type { Reference } from '@rasika/core/domain/raga/client';
import { MessageCircle } from 'lucide-react';
import { buttonVariants } from '~/components/ui/button';
import { AnalyticsEvent, trackEvent } from '~/lib/analytics';
import { RAGA_HELP_SECTION_LABELS, type RagaHelpSection, ragaHelpLink } from '~/lib/help-request';
import { cn } from '~/lib/utils';

/** Footnote markers after a fact, linking to its references. Nothing when uncited. */
export function Cite({ numbers }: { numbers?: number[] }) {
  if (!numbers?.length) return null;
  return (
    <sup className="ml-0.5 text-[0.7em] font-normal">
      {numbers.map((n, i) => (
        <span key={n}>
          {i > 0 && ','}
          <a href={`#ref-${n}`} className="text-primary hover:underline" aria-label={`Source ${n}`}>
            {n}
          </a>
        </span>
      ))}
    </sup>
  );
}

export interface SourceInfo {
  slug: string;
  title: string;
  citation: string;
  url?: string;
  licence?: string;
}

/** The numbered references at the foot of the page. */
export function RagaReferences({
  references,
  sources,
}: {
  references: Reference[];
  sources: Record<string, SourceInfo>;
}) {
  if (references.length === 0) return null;
  return (
    <section className="mt-8 pt-8 border-t" aria-labelledby="references-heading">
      <h2 id="references-heading" className="text-xl font-semibold mb-4">
        References
      </h2>
      <ol className="space-y-2 text-sm">
        {references.map(ref => {
          const source = sources[ref.sourceSlug];
          const locatorIsUrl = /^https?:\/\//.test(ref.locator);
          return (
            <li key={ref.number} id={`ref-${ref.number}`} className="flex gap-3 scroll-mt-24">
              <span className="w-6 shrink-0 text-right text-muted-foreground">{ref.number}.</span>
              <span>
                {source?.citation ?? ref.sourceSlug}
                {locatorIsUrl ? (
                  <>
                    {' '}
                    <a
                      href={ref.locator}
                      rel="nofollow noopener noreferrer"
                      target="_blank"
                      className="text-primary hover:underline break-all"
                    >
                      {ref.locator}
                    </a>
                  </>
                ) : (
                  <>, {ref.locator}</>
                )}
                {ref.tradition && <span className="text-muted-foreground"> ({ref.tradition})</span>}
              </span>
            </li>
          );
        })}
      </ol>
    </section>
  );
}

/**
 * The request for help in place of a section with nothing sourced. A plain `wa.me` link, so it
 * works without JavaScript; the click is counted when script is there.
 */
export function RagaHelpRequest({
  ragaName,
  section,
  pageUrl,
}: {
  ragaName: string;
  section: RagaHelpSection;
  pageUrl: string;
}) {
  return (
    <div className="rounded-lg border bg-muted/50 p-5 space-y-3">
      <p className="text-sm leading-relaxed">
        We have no source yet for {ragaName}: {RAGA_HELP_SECTION_LABELS[section]}. If you know a
        book, a page or a teacher&apos;s notes that say, tell us and we will add it with the source
        named.
      </p>
      <a
        href={ragaHelpLink({ ragaName, section, pageUrl })}
        target="_blank"
        rel="noopener noreferrer"
        onClick={() => trackEvent(AnalyticsEvent.RAGA_HELP_REQUEST, { section })}
        className={cn(buttonVariants({ variant: 'outline' }), 'min-h-11 md:min-h-10 no-underline')}
      >
        <MessageCircle className="mr-2 h-4 w-4" aria-hidden="true" />
        Tell us on WhatsApp
      </a>
    </div>
  );
}
