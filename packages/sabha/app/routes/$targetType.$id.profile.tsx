import { Button, Field, Input, Select, Textarea } from '@rasika/ui';
import type { ActionFunctionArgs, LoaderFunctionArgs } from 'react-router';
import { Form, data, useActionData, useLoaderData, useNavigation } from 'react-router';
import { useDashboard } from '~/components/dashboard-context';
import { FormError } from '~/components/shell';
import { createServerClient, errorMessage } from '~/lib/api.server';
import { requireUser } from '~/lib/auth.server';
import { SABHA_COPY, SABHA_EXTRA_COPY } from '~/lib/copy';
import { pageMeta } from '~/lib/meta';
import {
  ADDRESS_PARTS,
  buildProfileChanges,
  canEditProfile,
  isTargetType,
  profileFields,
} from '~/lib/sabha';

export const meta = () => pageMeta(SABHA_COPY.tabs.profile);

const ORGANISATION_TYPES = ['sabha', 'trust', 'ngo', 'temple', 'university', 'other'] as const;

function target(params: LoaderFunctionArgs['params']) {
  const { targetType, id } = params;
  if (!isTargetType(targetType) || !id) throw data(null, { status: 404 });
  return { targetType, targetId: id };
}

export async function loader({ request, params }: LoaderFunctionArgs) {
  await requireUser(request);
  const input = target(params);
  const trpc = await createServerClient(request);
  const { record } = await trpc.partner.profile.query(input);
  return { record: record as Record<string, unknown> };
}

export async function action({ request, params }: ActionFunctionArgs) {
  await requireUser(request);
  const input = target(params);
  const trpc = await createServerClient(request);
  const form = await request.formData();
  try {
    const { record } = await trpc.partner.profile.query(input);
    const changes = buildProfileChanges(input.targetType, form, record as Record<string, unknown>);
    if (Object.keys(changes).length === 0) {
      return { ok: true as const, message: SABHA_EXTRA_COPY.profileNothingChanged };
    }
    await trpc.partner.updateProfile.mutate({ ...input, input: changes });
    return { ok: true as const, message: SABHA_COPY.profileSaved };
  } catch (error) {
    return data({ ok: false as const, message: errorMessage(error) }, { status: 400 });
  }
}

const text = (value: unknown) => (value === undefined || value === null ? '' : String(value));

export default function Profile() {
  const { record } = useLoaderData<typeof loader>();
  const { targetType, overview } = useDashboard();
  const result = useActionData<typeof action>();
  const navigation = useNavigation();
  const editable = canEditProfile(overview.role as 'owner', overview.target.verifiedAt);
  const labels = SABHA_EXTRA_COPY.profileFields as Record<string, string>;
  const address = (record.address ?? {}) as Record<string, string | undefined>;

  return (
    <div className="max-w-xl">
      {editable ? null : (
        <p className="mb-4 text-sm text-muted-foreground">{SABHA_EXTRA_COPY.profileReadOnly}</p>
      )}
      {result?.message ? (
        result.ok ? (
          <output className="block mb-4 text-sm">{result.message}</output>
        ) : (
          <div className="mb-4">
            <FormError>{result.message}</FormError>
          </div>
        )
      ) : null}

      <Form method="post" className="space-y-4">
        {profileFields(targetType).map(field => {
          const id = `profile-${field.name}`;
          const value = text(record[field.name]);
          return (
            <Field key={field.name} label={labels[field.name] ?? field.name} htmlFor={id}>
              {field.kind === 'textarea' ? (
                <Textarea id={id} name={field.name} defaultValue={value} disabled={!editable} />
              ) : field.kind === 'select' ? (
                <Select id={id} name={field.name} defaultValue={value} disabled={!editable}>
                  <option value="">{''}</option>
                  {ORGANISATION_TYPES.map(type => (
                    <option key={type} value={type}>
                      {type}
                    </option>
                  ))}
                </Select>
              ) : (
                <Input
                  id={id}
                  name={field.name}
                  type={field.kind === 'number' ? 'number' : field.kind}
                  defaultValue={value}
                  disabled={!editable}
                />
              )}
            </Field>
          );
        })}

        {ADDRESS_PARTS.map(part => (
          <Field key={part} label={labels[part] ?? part} htmlFor={`profile-address-${part}`}>
            <Input
              id={`profile-address-${part}`}
              name={`address.${part}`}
              defaultValue={text(address[part])}
              disabled={!editable}
            />
          </Field>
        ))}

        {editable ? (
          <Button type="submit" pending={navigation.state === 'submitting'}>
            {SABHA_EXTRA_COPY.profileSave}
          </Button>
        ) : null}
      </Form>
    </div>
  );
}
