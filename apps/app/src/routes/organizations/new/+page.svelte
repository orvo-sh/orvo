<script lang="ts">
  import { Avatar, AvatarFallback } from '@repo/components/ui/avatar';
  import { Button } from '@repo/components/ui/button';
  import { Field, FieldDescription, FieldError, FieldGroup, FieldLabel } from '@repo/components/ui/field';
  import { Input } from '@repo/components/ui/input';

  import { authClient } from '$lib/auth-client';
  import { slugify } from '$lib/slugify';

  let { data } = $props();

  let name = $state('');
  let slug = $state('');
  let slugEdited = $state(false);
  let loading = $state(false);
  let error = $state('');

  const getInitials = (value: string) =>
    value
      .trim()
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase() ?? '')
      .join('') || 'O';

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
  <div class="w-full max-w-md">
    <div class="flex flex-col gap-6">
      <form
        onsubmit={(event) => {
          event.preventDefault();
          handleCreateOrganization();
        }}
      >
        <FieldGroup>
          <div class="flex flex-col items-center gap-3 text-center">
            <div class="bg-primary text-primary-foreground flex size-12 items-center justify-center rounded-xl text-sm font-semibold">
              O
            </div>
            <div class="space-y-1">
              <h1 class="text-xl font-semibold">Create your organization</h1>
              <FieldDescription>
                Set up a workspace for {data.user.email}. Keep it simple and start with the defaults.
              </FieldDescription>
            </div>
          </div>

          <div class="bg-muted/40 flex items-center gap-3 rounded-xl border p-3">
            <Avatar class="size-12 rounded-lg">
              <AvatarFallback class="rounded-lg">{getInitials(name)}</AvatarFallback>
            </Avatar>
            <div class="min-w-0">
              <p class="truncate font-medium">{name.trim() || 'Workspace preview'}</p>
              <p class="text-muted-foreground truncate text-sm">
                {slugify(slug) || 'workspace-slug'}
              </p>
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
                disabled={loading || name.trim().length < 2 || slug.length < 2}
                class="w-full"
              >
                {loading ? 'Creating organization...' : 'Create organization'}
              </Button>
            </Field>
          </div>
        </FieldGroup>
      </form>
    </div>
  </div>
</div>
