import type { Edit } from '@rasika/core/domain/edit/client';
import { EditEntityTypes, EditStatus } from '@rasika/core/domain/edit/client';
import { ArrowLeft, Loader2, Pencil, Save } from 'lucide-react';
import { useEffect } from 'react';
import type { ActionFunction, LoaderFunction } from 'react-router';
import { Form, data, redirect, useActionData, useLoaderData, useNavigation } from 'react-router';
import { toast } from 'sonner';
import { createServerClient } from '~/api.server';
import { Breadcrumb } from '~/components/Breadcrumb';
import { Button } from '~/components/ui/button';
import { Input } from '~/components/ui/input';
import { Label } from '~/components/ui/label';
import { Textarea } from '~/components/ui/textarea';
import { getUser } from '~/lib/auth.server';
import { generateTalaUrl, parseSlug } from '~/lib/url-slug';

export async function loader({
  request,
  params,
}: { request: Request; params: { talaid?: string } }) {
  const user = await getUser(request);
  if (!user) {
    return redirect(`/auth/login?redirectTo=${new URL(request.url).pathname}`);
  }

  const { talaid } = params;
  if (!talaid) {
    throw new Response('Tala ID is required', { status: 400 });
  }

  const parsed = parseSlug(talaid);
  if (!parsed) {
    throw new Response('Invalid URL format', { status: 400 });
  }

  const { id: slugId } = parsed;
  const serverClient = await createServerClient(request);
  const talaData = await serverClient.tala.get.query({ id: slugId });

  if (!talaData) {
    throw new Response('Tala not found', { status: 404 });
  }

  const activeEdit = await serverClient.edit.getActiveEditForEntity.query({
    entityType: EditEntityTypes.TALA,
    entityId: talaData.id,
  });

  if (activeEdit?.status === EditStatus.SUBMITTED) {
    return redirect(`/my-edits?editId=${activeEdit.id}`);
  }

  return data({ tala: talaData, user, activeEdit });
}

export async function action({
  request,
  params,
}: { request: Request; params: { talaid?: string } }) {
  const user = await getUser(request);
  if (!user) {
    return redirect('/auth/login');
  }

  const { talaid } = params;
  if (!talaid) {
    return data({ error: 'Tala ID is required' }, { status: 400 });
  }

  const parsed = parseSlug(talaid);
  if (!parsed) {
    return data({ error: 'Invalid URL format' }, { status: 400 });
  }

  const { id: slugId } = parsed;
  const formData = await request.formData();
  const intent = formData.get('intent') as string;

  const serverClient = await createServerClient(request);

  const tala = await serverClient.tala.get.query({ id: slugId });

  if (!tala) {
    return data({ error: 'Tala not found' }, { status: 404 });
  }

  const name = formData.get('name') as string;
  const userNote = formData.get('userNote') as string;

  const proposedValues: Record<string, unknown> = {};
  if (name !== tala.name) {
    proposedValues.name = name;
  }

  if (Object.keys(proposedValues).length === 0) {
    return data(
      { error: 'No changes detected. Please modify at least one field.' },
      { status: 400 }
    );
  }

  if (intent === 'save-draft' || intent === 'submit') {
    try {
      let editId = formData.get('editId') as string | undefined;

      const result = await serverClient.edit.saveChanges.mutate({
        entityType: EditEntityTypes.TALA,
        entityId: slugId,
        proposedValues,
        userNote: userNote || undefined,
        editId,
      });

      editId = result.id;

      if (intent === 'submit') {
        await serverClient.edit.submit.mutate({ editId });
        return data({ success: true, redirectUrl: generateTalaUrl(name, slugId) });
      }

      return data({ success: true, editId });
    } catch (error) {
      console.error('Failed to save changes:', error);
      return data({ error: 'Failed to save changes. Please try again.' }, { status: 500 });
    }
  }

  return data({ error: 'Invalid action' }, { status: 400 });
}

export default function EditTala() {
  const { tala, user, activeEdit } = useLoaderData<typeof loader>();
  const actionData = useActionData<typeof action>();
  const navigation = useNavigation();
  const talaUrl = generateTalaUrl(tala.name, tala.id);

  // Use draft values if editing an existing draft, otherwise use current entity values
  const defaultValues = {
    name: (activeEdit?.proposedValues.name as string | undefined) || tala.name,
    userNote: activeEdit?.userNote || '',
  };

  // Show toast and redirect on successful submission
  useEffect(() => {
    if (
      actionData &&
      'success' in actionData &&
      actionData.success &&
      'redirectUrl' in actionData
    ) {
      toast.success('Edit submitted for review');
      window.location.href = actionData.redirectUrl;
    }
  }, [actionData]);

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      <Breadcrumb
        items={[
          { label: 'Carnatic', path: '/carnatic' },
          { label: 'Talas', path: '/carnatic/talas' },
          { label: tala.name, path: talaUrl },
          { label: activeEdit ? 'Continue Editing' : 'Edit', path: '#' },
        ]}
      />

      <div className="mt-8">
        <div className="flex items-center gap-4 mb-6">
          <h1 className="text-2xl font-bold text-foreground">
            {activeEdit ? 'Continue Editing Tala' : 'Edit Tala'}
          </h1>
        </div>

        <div className="bg-card rounded-lg shadow-sm border p-6">
          <Form method="post" className="space-y-6">
            {activeEdit && <input type="hidden" name="editId" value={activeEdit.id} />}

            <div className="space-y-2">
              <Label htmlFor="name">Name</Label>
              <Input id="name" name="name" type="text" defaultValue={defaultValues.name} required />
            </div>

            <div className="space-y-2">
              <Label htmlFor="userNote">Edit Note (optional)</Label>
              <Textarea
                id="userNote"
                name="userNote"
                rows={3}
                placeholder="Explain the changes you're making..."
                defaultValue={defaultValues.userNote}
              />
            </div>

            <div className="flex items-center justify-end gap-4 pt-4 border-t">
              <a
                href={talaUrl}
                className="px-4 py-2 text-sm font-medium text-muted-foreground hover:text-foreground flex items-center gap-2 transition-colors"
              >
                <ArrowLeft className="h-4 w-4" />
                Cancel
              </a>
              <Button
                variant="ghost"
                type="submit"
                name="intent"
                value="save-draft"
              >
                {navigation.formData?.get('intent') === 'save-draft' ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Saving...
                  </>
                ) : (
                  <>
                    <Save className="h-4 w-4" />
                    Save Draft
                  </>
                )}
              </Button>
              <Button
                variant="default"
                type="submit"
                name="intent"
                value="submit"
              >
                {navigation.formData?.get('intent') === 'submit' ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Submitting...
                  </>
                ) : (
                  <>
                    <Pencil className="mr-2 h-4 w-4" />
                    Submit for Review
                  </>
                )}
              </Button>
            </div>
          </Form>
        </div>

        <div className="mt-6 bg-yellow-50 border border-yellow-200 rounded-lg p-4 dark:bg-yellow-950 dark:border-yellow-800">
          <h3 className="text-sm font-medium text-yellow-800 dark:text-yellow-200">
            About Edit Submissions
          </h3>
          <p className="mt-1 text-sm text-yellow-700 dark:text-yellow-300">
            Your edit will be submitted for review by a moderator. Once approved, the changes will
            be visible to everyone.
          </p>
        </div>
      </div>
    </div>
  );
}
