import { Badge, EmptyState, Table, TableScroll, Td, Th, Tr } from '@rasika/ui';
import { useDashboard } from '~/components/dashboard-context';
import { SABHA_COPY, SABHA_EXTRA_COPY } from '~/lib/copy';
import { pageMeta } from '~/lib/meta';

export const meta = () => pageMeta(SABHA_COPY.tabs.codes);

/**
 * QR codes placed at this venue (an organiser sees its home venue's), read-only: assignment
 * stays with moderators. The numbers come from the overview, so this screen asks for nothing.
 */
export default function Codes() {
  const { overview, targetType } = useDashboard();
  const codes = overview.codes;

  if (codes.length === 0) {
    return (
      <EmptyState title={SABHA_EXTRA_COPY.codesNone}>
        {targetType === 'organiser' ? SABHA_EXTRA_COPY.codeNoHome : null}
      </EmptyState>
    );
  }

  return (
    <TableScroll>
      <Table>
        <thead>
          <Tr>
            <Th>{SABHA_EXTRA_COPY.codeCode}</Th>
            <Th>{SABHA_EXTRA_COPY.codeLabel}</Th>
            <Th>{SABHA_EXTRA_COPY.codeSpace}</Th>
            <Th>{SABHA_EXTRA_COPY.codeScans}</Th>
            <Th>{SABHA_EXTRA_COPY.codeScansWeek}</Th>
            <Th>{SABHA_EXTRA_COPY.codeFollows}</Th>
          </Tr>
        </thead>
        <tbody>
          {codes.map(code => (
            <Tr
              key={code.code}
              className={code.status === 'retired' ? 'text-muted-foreground' : ''}
            >
              <Td className="font-mono">
                {code.code}
                {code.status === 'retired' ? (
                  <Badge className="ml-2">{SABHA_EXTRA_COPY.codeRetired}</Badge>
                ) : null}
              </Td>
              <Td>{code.label ?? ''}</Td>
              <Td>{code.spaceName ?? ''}</Td>
              <Td className="tabular-nums">{code.scansTotal}</Td>
              <Td className="tabular-nums">{code.scansLast7Days}</Td>
              <Td className="tabular-nums">{code.follows}</Td>
            </Tr>
          ))}
        </tbody>
      </Table>
    </TableScroll>
  );
}
