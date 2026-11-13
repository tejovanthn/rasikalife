import {
  Button,
  EmptyState,
  Field,
  Input,
  SectionTitle,
  Table,
  TableScroll,
  Td,
  Th,
  Tr,
} from '@rasika/ui';
import type { ActionFunctionArgs, LoaderFunctionArgs } from 'react-router';
import { Form, data, useActionData, useLoaderData, useNavigation } from 'react-router';
import { useDashboard } from '~/components/dashboard-context';
import { FormError } from '~/components/shell';
import { createServerClient, errorMessage } from '~/lib/api.server';
import { requireUser } from '~/lib/auth.server';
import { SABHA_EXTRA_COPY } from '~/lib/copy';
import { pageMeta } from '~/lib/meta';
import type { DashboardRole } from '~/lib/sabha';
import {
  canRevokeMember,
  canWithdrawInvite,
  expiryLabel,
  isOwner,
  isTargetType,
} from '~/lib/sabha';

export const meta = () => pageMeta(SABHA_EXTRA_COPY.teamTab);

function target(params: LoaderFunctionArgs['params']) {
  const { targetType, id } = params;
  if (!isTargetType(targetType) || !id) throw data(null, { status: 404 });
  return { targetType, targetId: id };
}

/** `partner.teamForTarget` is also the access check: any member, or a moderator, reads it. */
export async function loader({ request, params }: LoaderFunctionArgs) {
  await requireUser(request);
  const input = target(params);
  const trpc = await createServerClient(request);
  return { team: await trpc.partner.teamForTarget.query(input) };
}

/**
 * An owner invites a viewer, revokes a viewer, or withdraws an unaccepted invite. Each is a
 * strict-owner procedure, so a viewer or a moderator posting by hand is refused there. The form
 * never sends a role: the server makes every invite a viewer's.
 */
export async function action({ request, params }: ActionFunctionArgs) {
  await requireUser(request);
  const input = target(params);
  const form = await request.formData();
  const intent = String(form.get('intent') ?? '');
  const trpc = await createServerClient(request);
  try {
    if (intent === 'invite') {
      const email = String(form.get('email') ?? '').trim();
      const sent = await trpc.partner.inviteViewer.mutate({ ...input, email });
      return {
        ok: true as const,
        message: sent.emailSent
          ? SABHA_EXTRA_COPY.teamInviteSent(sent.email)
          : SABHA_EXTRA_COPY.teamInviteSavedNoEmail(sent.email),
      };
    }
    if (intent === 'revoke') {
      await trpc.partner.revokeViewer.mutate({
        ...input,
        userId: String(form.get('userId') ?? ''),
      });
      return { ok: true as const, message: SABHA_EXTRA_COPY.teamRevoked };
    }
    if (intent === 'withdraw') {
      await trpc.partner.withdrawInvite.mutate({
        ...input,
        email: String(form.get('email') ?? ''),
      });
      return { ok: true as const, message: SABHA_EXTRA_COPY.teamWithdrawn };
    }
    throw data(null, { status: 400 });
  } catch (error) {
    if (error instanceof Response) throw error;
    return data({ ok: false as const, message: errorMessage(error) }, { status: 400 });
  }
}

export default function Team() {
  const { team } = useLoaderData<typeof loader>();
  const { overview } = useDashboard();
  const result = useActionData<typeof action>();
  const navigation = useNavigation();
  const role = overview.role as DashboardRole;
  const pending = navigation.state === 'submitting';

  return (
    <div className="max-w-3xl">
      {isOwner(role) ? null : (
        <p className="mb-4 text-sm text-muted-foreground">{SABHA_EXTRA_COPY.teamReadOnly}</p>
      )}
      {result?.message ? (
        result.ok ? (
          <output className="mb-4 block text-sm">{result.message}</output>
        ) : (
          <div className="mb-4">
            <FormError>{result.message}</FormError>
          </div>
        )
      ) : null}

      <SectionTitle>{SABHA_EXTRA_COPY.teamMembers}</SectionTitle>
      {team.members.length === 0 ? (
        <div className="my-4">
          <EmptyState title={SABHA_EXTRA_COPY.teamNoMembers} />
        </div>
      ) : (
        <TableScroll>
          <Table>
            <thead>
              <Tr>
                <Th>{SABHA_EXTRA_COPY.teamName}</Th>
                <Th>{SABHA_EXTRA_COPY.teamEmail}</Th>
                <Th>{SABHA_EXTRA_COPY.teamRole}</Th>
                <Th>
                  <span className="sr-only">{SABHA_EXTRA_COPY.teamRevoke}</span>
                </Th>
              </Tr>
            </thead>
            <tbody>
              {team.members.map(member => (
                <Tr key={member.userId}>
                  <Td>
                    {member.name ?? ''}
                    {member.userId === team.selfUserId ? (
                      <span className="ml-2 text-sm text-muted-foreground">
                        ({SABHA_EXTRA_COPY.teamYou})
                      </span>
                    ) : null}
                  </Td>
                  <Td>{member.email ?? ''}</Td>
                  <Td>
                    {SABHA_EXTRA_COPY.roleLabel[member.role as 'owner' | 'viewer'] ?? member.role}
                  </Td>
                  <Td>
                    {canRevokeMember(role, team.selfUserId, member) ? (
                      <Form method="post">
                        <input type="hidden" name="intent" value="revoke" />
                        <input type="hidden" name="userId" value={member.userId} />
                        <Button type="submit" variant="secondary" pending={pending}>
                          {SABHA_EXTRA_COPY.teamRevoke}
                        </Button>
                      </Form>
                    ) : null}
                  </Td>
                </Tr>
              ))}
            </tbody>
          </Table>
        </TableScroll>
      )}
      {isOwner(role) ? (
        <p className="mt-2 text-sm text-muted-foreground">{SABHA_EXTRA_COPY.teamOwnersNote}</p>
      ) : null}

      <div className="mt-8">
        <SectionTitle>{SABHA_EXTRA_COPY.teamPending}</SectionTitle>
      </div>
      {team.invites.length === 0 ? (
        <p className="mt-2 text-sm text-muted-foreground">{SABHA_EXTRA_COPY.teamNoPending}</p>
      ) : (
        <TableScroll>
          <Table>
            <thead>
              <Tr>
                <Th>{SABHA_EXTRA_COPY.teamEmail}</Th>
                <Th>{SABHA_EXTRA_COPY.teamRole}</Th>
                <Th>{SABHA_EXTRA_COPY.teamExpires}</Th>
                <Th>
                  <span className="sr-only">{SABHA_EXTRA_COPY.teamWithdraw}</span>
                </Th>
              </Tr>
            </thead>
            <tbody>
              {team.invites.map(invite => (
                <Tr key={invite.email}>
                  <Td>{invite.email}</Td>
                  <Td>
                    {SABHA_EXTRA_COPY.roleLabel[invite.role as 'owner' | 'viewer'] ?? invite.role}
                  </Td>
                  <Td>{expiryLabel(invite.expiresAt)}</Td>
                  <Td>
                    {canWithdrawInvite(role, invite) ? (
                      <Form method="post">
                        <input type="hidden" name="intent" value="withdraw" />
                        <input type="hidden" name="email" value={invite.email} />
                        <Button type="submit" variant="secondary" pending={pending}>
                          {SABHA_EXTRA_COPY.teamWithdraw}
                        </Button>
                      </Form>
                    ) : null}
                  </Td>
                </Tr>
              ))}
            </tbody>
          </Table>
        </TableScroll>
      )}

      {isOwner(role) ? (
        <div className="mt-8">
          <SectionTitle>{SABHA_EXTRA_COPY.teamInviteHeading}</SectionTitle>
          <p className="mt-2 text-sm text-muted-foreground">{SABHA_EXTRA_COPY.teamInviteHint}</p>
          <Form method="post" className="mt-3 grid gap-3 md:grid-cols-[2fr_auto] md:items-end">
            <input type="hidden" name="intent" value="invite" />
            <Field label={SABHA_EXTRA_COPY.teamInviteEmail} htmlFor="invite-email">
              <Input id="invite-email" name="email" type="email" required autoComplete="off" />
            </Field>
            <Button type="submit" pending={pending}>
              {SABHA_EXTRA_COPY.teamInviteSubmit}
            </Button>
          </Form>
        </div>
      ) : null}
    </div>
  );
}
