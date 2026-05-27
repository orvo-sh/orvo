<script lang="ts">
  import { Button } from '@repo/components/ui/button';
  import { Field, FieldDescription, FieldError, FieldGroup, FieldLabel } from '@repo/components/ui/field';
  import { OrvoLogo } from '@repo/components/icons/orvo-logo';
  import { Input } from '@repo/components/ui/input';

  import { authClient } from '$lib/auth-client';
  import { slugify } from '$lib/slugify';

  let name = $state('');
  let slug = $state('');
  let slugEdited = $state(false);
  let loading = $state(false);
  let error = $state('');

  $effect(() => {
    if (slugEdited) return;
    slug = slugify(name);
  });

  const handleCreateOrganization = async () => {
    loading = true;
    error = '';

    await authClient.organization.create(
      {
        name: name.trim(),
        slug: slugify(slug)
      },
      {
        onSuccess: () => {
          location.href = '/';
        },
        onError: (ctx) => {
          error = ctx.error.message;
          loading = false;
        }
      }
    );
  };
</script>

<div class="flex min-h-svh flex-col items-center justify-center gap-6 p-6 md:p-10">
  <div class="w-full max-w-sm">
    <div class="flex flex-col gap-6">
      <form
        onsubmit={(event) => {
          event.preventDefault();
          handleCreateOrganization();
        }}
      >
        <FieldGroup>
          <div class="flex flex-col items-center gap-2 text-center">
            <OrvoLogo class="size-12" />
            <div class="space-y-1">
              <h1 class="text-xl font-semibold">Create your organization</h1>
              <FieldDescription>
                An organization houses your teammates and telemetry data.
              </FieldDescription>
            </div>
          </div>

          <div class="grid gap-3">
            <Field>
              <FieldLabel for="organization-name">Organization name</FieldLabel>
              <Input
                id="organization-name"
                bind:value={name}
                minlength={2}
                maxlength={64}
                placeholder="Acme"
                required
              />
            </Field>

            <Field>
              <FieldLabel for="organization-slug">Workspace slug</FieldLabel>
              <Input
                id="organization-slug"
                value={slug}
                minlength={2}
                maxlength={64}
                placeholder="acme"
                oninput={(event) => {
                  slugEdited = true;
                  slug = slugify((event.currentTarget as HTMLInputElement).value);
                }}
                required
              />
              <FieldDescription>Your workspace URL will use this slug.</FieldDescription>
            </Field>

            <FieldError>{error}</FieldError>

            <Field>
              <Button
                type="submit"
                disabled={name.trim().length < 2 || slug.length < 2}
                loading={loading}
                class="w-full"
              >
                Create organization
              </Button>
            </Field>
          </div>
        </FieldGroup>
      </form>
    </div>
  </div>
</div>
