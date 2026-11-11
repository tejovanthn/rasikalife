import {
  Badge,
  Button,
  EmptyState,
  Field,
  Input,
  PageTitle,
  SectionTitle,
  Select,
  Table,
  TableScroll,
  Td,
  Th,
  Tr,
} from '@rasika/ui';
import type { ActionFunctionArgs, LoaderFunctionArgs } from 'react-router';
import { Form, Link, data, useActionData, useLoaderData, useNavigation } from 'react-router';
import { Chrome, FormError } from '~/components/chrome';
import { createServerClient, errorMessage, siteUrl } from '~/lib/api.server';
import { requireModerator } from '~/lib/auth.server';
import { ADMIN_COPY, ADMIN_EXTRA_COPY } from '~/lib/copy';
import { pageMeta } from '~/lib/meta';
import { isTargetType } from '~/lib/partners';

export const meta = () => pageMeta(ADMIN_EXTRA_COPY.partners);

function target(params: LoaderFunctionArgs['params']) {
  const { targetType, id } = params;
  if (!isTargetType(targetType) || !id) throw data(null, { status: 404 });
  return { targetType, targetId: id };
}

export async function loader({ request, params }: LoaderFunctionArgs) {
  await requireModerator(request);
  const input = target(params);
  const trpc = await createServerClient(request);
  const result = await trpc.partner.members.query(input);
  if (!result.targetName) throw data(null, { status: 404 });
  return { ...input, ...result, siteUrl: siteUrl() };
}

export async function action({ request, params }: ActionFunctionArgs) {
  await requireModerator(request);
  const input = target(params);
  const form = await request.formData();
  const intent = String(form.get('intent') ?? '');
  const trpc = await createServerClient(request);

  try {
    if (intent === 'invite') {
      const email = String(form.get('email') ?? '').trim();
      const role = form.get('role') === 'owner' ? 'owner' : 'viewer';
      const sent = await trpc.partner.invite.mutate({ ...input, email, role });
      return {
        ok: true as const,
        message: sent.emailSent
          ? ADMIN_EXTRA_COPY.partnersInviteSent(sent.email)
          : ADMIN_EXTRA_COPY.partnersInviteSavedNoEmail(sent.email),
      };
    }
    if (intent === 'revoke') {
      await trpc.partner.revoke.mutate({ ...input, userId: String(form.get('userId') ?? '') });
      return { ok: true as const, message: ADMIN_EXTRA_COPY.partnersRevoked };
    }
    if (intent === 'review' && input.targetType === 'organiser') {
      const require = form.get('require') === 'true';
      await trpc.partner.setEventReview.mutate({ organiserId: input.targetId, require });
      return {
        ok: true as const,
        message: require ? ADMIN_EXTRA_COPY.partnersReviewOn : ADMIN_EXTRA_COPY.partnersReviewOff,
      };
    }
    return data({ ok: false as const, message: errorMessage(null) }, { status: 400 });
  } catch (error) {
    return data({ ok: false as const, message: errorMessage(error) }, { status: 400 });
  }
}

export default function PartnerTarget() {
  const loaded = useLoaderData<typeof loader>();
  const result = useActionData<typeof action>();
  const navigation = useNavigation();
  const sending =
    navigation.state === 'submitting' && navigation.formData?.get('intent') === 'invite';
  const publicPath = loaded.targetType === 'venue' ? 'venues' : 'organisers';

  return (
    <Chrome>
      <div className="mb-2 flex flex-wrap items-center gap-3">
        <PageTitle>{loaded.targetName}</PageTitle>
        <Badge>{ADMIN_EXTRA_COPY.partnersType[loaded.targetType]}</Badge>
        {loaded.verifiedAt ? (
          <Badge tone="success">{ADMIN_EXTRA_COPY.partnersVerified}</Badge>
        ) : null}
      </div>
      <p className="mb-6 text-sm text-muted-foreground">
        {loaded.verifiedAt ? null : <>{ADMIN_EXTRA_COPY.partnersNotVerified} </>}
        <a className="underline" href={`${loaded.siteUrl}/${publicPath}/${loaded.targetId}`}>
          {ADMIN_EXTRA_COPY.partnersOpenPage}
        </a>
      </p>

      {result?.message ? (
        result.ok ? (
          <p role="status" className="mb-6 text-sm">
            {result.message}
          </p>
        ) : (
          <div className="mb-6">
            <FormError>{result.message}</FormError>
          </div>
        )
      ) : null}

      <SectionTitle>{ADMIN_EXTRA_COPY.partnersInviteHeading}</SectionTitle>
      <Form method="post" className="mb-2 mt-2 max-w-md space-y-3">
        <input type="hidden" name="intent" value="invite" />
        <Field label={ADMIN_COPY.invite.email} htmlFor="invite-email">
          <Input id="invite-email" name="email" type="email" required autoComplete="off" />
        </Field>
        <Field label={ADMIN_COPY.invite.role} htmlFor="invite-role">
          <Select id="invite-role" name="role" defaultValue="owner">
            <option value="owner">{ADMIN_COPY.invite.owner}</option>
            <option value="viewer">{ADMIN_COPY.invite.viewer}</option>
          </Select>
        </Field>
        <Button type="submit" pending={sending}>
          {ADMIN_COPY.invite.submit}
        </Button>
      </Form>
      <p className="mb-8 text-sm text-muted-foreground">{ADMIN_EXTRA_COPY.partnersInviteExpiry}</p>

      <SectionTitle>{ADMIN_EXTRA_COPY.partnersMembers}</SectionTitle>
      <div className="mb-8 mt-2">
        {loaded.members.length === 0 ? (
          <EmptyState title={ADMIN_EXTRA_COPY.partnersNoMembers} />
        ) : (
          <TableScroll>
            <Table>
              <thead>
                <Tr>
                  <Th>{ADMIN_EXTRA_COPY.partnersMemberName}</Th>
                  <Th>{ADMIN_EXTRA_COPY.partnersMemberEmail}</Th>
                  <Th>{ADMIN_EXTRA_COPY.partnersMemberRole}</Th>
                  <Th>
                    <span className="sr-only">{ADMIN_EXTRA_COPY.partnersRevoke}</span>
                  </Th>
                </Tr>
              </thead>
              <tbody>
                {loaded.members.map(member => (
                  <Tr key={member.userId}>
                    <Td>{member.name ?? member.userId}</Td>
                    <Td>{member.email ?? ''}</Td>
                    <Td>
                      {member.role === 'owner' ? ADMIN_COPY.invite.owner : ADMIN_COPY.invite.viewer}
                    </Td>
                    <Td>
                      <Form method="post">
                        <input type="hidden" name="intent" value="revoke" />
                        <input type="hidden" name="userId" value={member.userId} />
                        <Button type="submit" variant="ghost">
                          {ADMIN_EXTRA_COPY.partnersRevoke}
                        </Button>
                      </Form>
                    </Td>
                  </Tr>
                ))}
              </tbody>
            </Table>
          </TableScroll>
        )}
      </div>

      {loaded.targetType === 'organiser' ? (
        <>
          <SectionTitle>{ADMIN_EXTRA_COPY.partnersReviewHeading}</SectionTitle>
          <Form method="post" className="mt-2 max-w-md space-y-3">
            <input type="hidden" name="intent" value="review" />
            <input
              type="hidden"
              name="require"
              value={loaded.requireEventReview ? 'false' : 'true'}
            />
            <p className="text-sm">
              {loaded.requireEventReview
                ? ADMIN_EXTRA_COPY.partnersReviewOn
                : ADMIN_EXTRA_COPY.partnersReviewOff}
            </p>
            <Button type="submit" variant="secondary">
              {loaded.requireEventReview
                ? ADMIN_EXTRA_COPY.partnersReviewTurnOff
                : ADMIN_EXTRA_COPY.partnersReviewTurnOn}
            </Button>
          </Form>
        </>
      ) : null}

      <p className="mt-10 text-sm">
        <Link className="text-primary underline" to="/partners">
          {ADMIN_EXTRA_COPY.partners}
        </Link>
      </p>
    </Chrome>
  );
}
