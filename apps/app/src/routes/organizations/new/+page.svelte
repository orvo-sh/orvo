<script lang="ts">
  import { Button } from '@repo/components/ui/button';
  import { Field, FieldDescription, FieldError, FieldGroup, FieldLabel } from '@repo/components/ui/field';
  import { OrvoLogo } from '@repo/components/icons/orvo-logo';
  import { Input } from '@repo/components/ui/input';

  import { slugify } from '@repo/utils';
  import { authClient } from '$lib/auth-client';
  import { isValidOrganizationSlug } from '$lib/organization-slug';
  import { onDestroy } from 'svelte';

  let name = $state('');
  let slug = $state('');
  let slugEdited = $state(false);
  let loading = $state(false);
  let error = $state('');
  let slugStatus = $state<'idle' | 'checking' | 'available' | 'error'>('idle');
  let slugCheckTimeout = $state<ReturnType<typeof setTimeout> | null>(null);
  let slugCheckRequest = $state(0);

  $effect(() => {
    if (slugEdited) return;
    slug = slugify(name);
  });

  $effect(() => {
    slug;
    error = '';
    scheduleSlugCheck();
  });

  const checkSlugAvailability = async (value: string) => {
    const normalizedSlug = slugify(value);

    if (!normalizedSlug || !isValidOrganizationSlug(normalizedSlug)) {
      slugStatus = 'error';
      return false;
    }

    slugStatus = 'checking';

    try {
      const response = await fetch(
        `/api/organizations/slug-availability?slug=${encodeURIComponent(normalizedSlug)}`
      );

      if (!response.ok) {
        slugStatus = 'error';
        return false;
      }

      const result = (await response.json()) as { available?: boolean };
      slugStatus = result.available ? 'available' : 'error';
      return result.available === true;
    } catch {
      slugStatus = 'error';
      return false;
    }
  };

  const scheduleSlugCheck = () => {
    if (slugCheckTimeout) {
      clearTimeout(slugCheckTimeout);
    }

    const normalizedSlug = slugify(slug);
    slugCheckRequest += 1;
    const requestId = slugCheckRequest;

    if (!normalizedSlug || !isValidOrganizationSlug(normalizedSlug)) {
      slugStatus = normalizedSlug.length === 0 ? 'idle' : 'error';
      return;
    }

    slugStatus = 'checking';
    slugCheckTimeout = setTimeout(async () => {
      if (requestId !== slugCheckRequest) {
        return;
      }

      await checkSlugAvailability(normalizedSlug);
    }, 250);
  };

  const handleCreateOrganization = async () => {
    const trimmedName = name.trim();
    const normalizedSlug = slugify(slug);

    if (trimmedName.length < 2) {
      error = 'Organization name must be at least 2 characters.';
      return;
    }

    if (!(await checkSlugAvailability(normalizedSlug))) {
      error = 'Choose an available slug with only lowercase letters, numbers, and hyphens.';
      return;
    }

    loading = true;
    error = '';

    await authClient.organization.create(
      {
        name: trimmedName,
        slug: normalizedSlug
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

  const getSlugHelpText = () => {
    if (slugStatus === 'checking') {
      return 'Checking slug availability...';
    }

    if (slugStatus === 'available') {
      return 'This slug is available.';
    }

    return 'Your workspace URL will use this slug.';
  };

  const getSlugError = () => {
    if (slugStatus !== 'error') {
      return '';
    }

    if (!slug || slug.length < 2) {
      return 'Slug must be at least 2 characters.';
    }

    if (!isValidOrganizationSlug(slug)) {
      return 'Use lowercase letters, numbers, and hyphens. Reserved slugs are not allowed.';
    }

    return 'That slug is already taken.';
  };

  onDestroy(() => {
    if (slugCheckTimeout) {
      clearTimeout(slugCheckTimeout);
    }
  });
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
              <FieldDescription>{getSlugHelpText()}</FieldDescription>
              <FieldError>{getSlugError()}</FieldError>
            </Field>

            <FieldError>{error}</FieldError>

            <Field>
              <Button
                type="submit"
                disabled={
                  loading ||
                  name.trim().length < 2 ||
                  slug.length < 2 ||
                  slugStatus === 'checking' ||
                  slugStatus === 'error'
                }
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
