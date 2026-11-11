import { Badge } from '~/components/ui/badge';
import { canAct, formatLastScanned, panelActionUrl, sortPanelRows } from '~/lib/venue-qr-panel';
import type { PanelStat } from '~/lib/venue-qr-panel';

/**
 * Moderators only (decisions.md #5). The venue page renders it only for a moderator, and the rows
 * come from a moderator-only call. Actions open the admin app, which holds the forms.
 */
export function VenueQrPanel({
  rows,
  adminBase,
}: {
  rows: PanelStat[];
  adminBase: string;
}) {
  const sorted = sortPanelRows(rows);

  return (
    <section className="mt-6 mb-8" aria-labelledby="venue-qr-heading">
      <div className="flex items-center justify-between gap-4 mb-3">
        <h2 id="venue-qr-heading" className="text-2xl font-bold">
          QR codes
        </h2>
        <a className="text-sm text-primary underline" href={`${adminBase}/qr/batches/new`}>
          New batch
        </a>
      </div>
      {sorted.length === 0 ? (
        // TODO(copy): empty state is not in copy.md.
        <p className="text-sm text-muted-foreground">No QR codes at this venue yet.</p>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-border">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left text-xs uppercase tracking-wide text-muted-foreground">
                <th className="px-3 py-2 font-medium">Code and label</th>
                <th className="px-3 py-2 font-medium">Scans (7 days, total)</th>
                <th className="px-3 py-2 font-medium">Follows from this code</th>
                <th className="px-3 py-2 font-medium">Last scanned</th>
                <th className="px-3 py-2 font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {sorted.map(row => (
                <tr key={row.code} className="border-b border-border last:border-0">
                  <td className="px-3 py-3">
                    <span className="font-mono">{row.code}</span>
                    {row.status === 'retired' ? (
                      <Badge variant="outline" className="ml-2">
                        Retired
                      </Badge>
                    ) : null}
                    {row.label ? <div className="text-muted-foreground">{row.label}</div> : null}
                  </td>
                  <td className="px-3 py-3 whitespace-nowrap">
                    {row.scansLast7Days} / {row.scansTotal}
                  </td>
                  <td className="px-3 py-3">{row.follows}</td>
                  <td className="px-3 py-3 whitespace-nowrap">
                    {formatLastScanned(row.lastScannedAt)}
                  </td>
                  <td className="px-3 py-3 whitespace-nowrap space-x-3">
                    {canAct(row.status) ? (
                      <>
                        <a
                          className="text-primary underline"
                          href={panelActionUrl(adminBase, row.code, 'label')}
                        >
                          Edit label
                        </a>
                        <a
                          className="text-primary underline"
                          href={panelActionUrl(adminBase, row.code, 'reassign')}
                        >
                          Reassign
                        </a>
                        <a
                          className="text-destructive underline"
                          href={panelActionUrl(adminBase, row.code, 'retire')}
                        >
                          Retire
                        </a>
                      </>
                    ) : null}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
