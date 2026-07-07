<script lang="ts">
  import { browser } from "$app/environment";
  import { Badge } from "@repo/components/ui/badge";
  import { Button } from "@repo/components/ui/button";
  import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
  } from "@repo/components/ui/card";
  import { Checkbox } from "@repo/components/ui/checkbox";
  import { Label } from "@repo/components/ui/label";
  import { Separator } from "@repo/components/ui/separator";
  import * as Select from "@repo/components/ui/select";
  import type { ActionData, PageData } from "./$types";

  let { data, form }: { data: PageData; form: ActionData } = $props();

  const oauthIdentityScopes = ["openid", "profile", "email", "offline_access"];
  const formOrganizationId =
    form && "organizationId" in form && typeof form.organizationId === "string"
      ? form.organizationId
      : null;
  const formSelectedAppIds =
    form && "selectedAppIds" in form && Array.isArray(form.selectedAppIds)
      ? form.selectedAppIds.filter(
          (value): value is string => typeof value === "string",
        )
      : null;

  let selectedOrganizationId = $state<string>(
    formOrganizationId ?? data.selectedOrganizationId,
  );
  let selectedAppIds = $state<string[]>(
    formSelectedAppIds ?? data.selectedAppIds,
  );

  const selectedOrganization = $derived(
    data.organizations.find(
      (organization) => organization.id === selectedOrganizationId,
    ) ?? null,
  );
  const apps = $derived(
    (data.appsByOrganization[selectedOrganizationId] ?? []) as Array<{
      id: string;
      name: string;
    }>,
  );
  const toolScopes = $derived(
    data.scopes.filter((scope) => !oauthIdentityScopes.includes(scope)),
  );
  const identityScopes = $derived(
    data.scopes.filter((scope) => oauthIdentityScopes.includes(scope)),
  );
  const submittedOauthQuery = $derived(
    browser && window.location.search.length > 1
      ? window.location.search.slice(1)
      : data.oauthQuery,
  );

  $effect(() => {
    const nextSelectedAppIds = selectedAppIds.filter((appId) =>
      apps.some((app) => app.id === appId),
    );

    if (
      nextSelectedAppIds.length !== selectedAppIds.length ||
      nextSelectedAppIds.some((appId, index) => appId !== selectedAppIds[index])
    ) {
      selectedAppIds = nextSelectedAppIds;
    }
  });

  const toggleApp = (appId: string, checked: boolean) => {
    selectedAppIds = checked
      ? [...new Set([...selectedAppIds, appId])]
      : selectedAppIds.filter((value) => value !== appId);
  };

  const scopeLabels: Record<string, string> = {
    openid: "Identify your account",
    profile: "Read your profile",
    email: "Read your email",
    offline_access: "Refresh access when you are away",
    "app:read": "Read app metadata",
    "app:write": "Modify app configuration",
    "logs:read": "Read logs",
    "traces:read": "Read traces",
    "metrics:read": "Read metrics",
    "incidents:read": "Read incidents",
    "incidents:write": "Modify incidents",
    "heartbeats:read": "Read heartbeats",
    "heartbeats:write": "Modify heartbeats",
    "alerts:read": "Read alerts",
    "alerts:write": "Modify alerts",
  };
</script>

<svelte:head>
  <title>Authorize MCP access</title>
</svelte:head>

<div class="min-h-screen bg-muted/30">
  <div
    class="mx-auto flex w-full max-w-6xl flex-col gap-6 px-4 py-8 sm:px-6 lg:px-8"
  >
    <Card class="overflow-hidden border-border/70">
      <CardContent class="grid gap-6 p-0 lg:grid-cols-[minmax(0,1.3fr)_320px]">
        <div class="space-y-5 p-6 lg:p-8">
          <div class="flex items-start gap-4">
            {#if data.client.icon}
              <img
                src={data.client.icon}
                alt={data.client.name}
                class="size-14 rounded-2xl border bg-background object-cover shadow-sm"
              />
            {/if}

            <div class="space-y-3">
              <Badge variant="outline">Orvo MCP authorization</Badge>
              <div class="space-y-2">
                <h1
                  class="text-2xl font-semibold tracking-tight text-foreground"
                >
                  {data.client.name} wants access to your Orvo data
                </h1>
                <p class="max-w-2xl text-sm leading-6 text-muted-foreground">
                  Choose which organization and apps this client can access
                  through MCP. The selected permissions apply only to the apps
                  you allow below.
                </p>
              </div>
            </div>
          </div>

          <div
            class="grid gap-3 rounded-2xl border bg-background/80 p-4 text-sm sm:grid-cols-2"
          >
            <div class="space-y-1">
              <p
                class="text-xs font-medium tracking-[0.14em] text-muted-foreground uppercase"
              >
                Client
              </p>
              <p class="font-medium text-foreground">{data.client.name}</p>
              <p class="text-xs break-all text-muted-foreground">
                {data.client.clientId}
              </p>
            </div>

            <div class="space-y-1">
              <p
                class="text-xs font-medium tracking-[0.14em] text-muted-foreground uppercase"
              >
                Redirect URI
              </p>
              <p class="text-sm break-all text-foreground">
                {data.client.redirectUrls[0] ?? "Not provided"}
              </p>
            </div>
          </div>
        </div>

        <div
          class="border-t bg-background/70 p-6 lg:border-t-0 lg:border-l lg:p-8"
        >
          <div class="space-y-4">
            <div class="space-y-1">
              <p class="text-sm font-medium text-foreground">
                What this grants
              </p>
              <p class="text-sm leading-6 text-muted-foreground">
                Access is limited to your chosen apps and the scopes listed
                below.
              </p>
            </div>

            <div class="grid gap-2">
              <div
                class="flex items-center justify-between rounded-xl border px-3 py-2"
              >
                <span class="text-sm text-muted-foreground">Tool scopes</span>
                <Badge variant="secondary">{toolScopes.length}</Badge>
              </div>
              <div
                class="flex items-center justify-between rounded-xl border px-3 py-2"
              >
                <span class="text-sm text-muted-foreground"
                  >Identity scopes</span
                >
                <Badge variant="secondary">{identityScopes.length}</Badge>
              </div>
              <div
                class="flex items-center justify-between rounded-xl border px-3 py-2"
              >
                <span class="text-sm text-muted-foreground">Selected apps</span>
                <Badge variant="secondary">{selectedAppIds.length}</Badge>
              </div>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>

    <form
      method="POST"
      class="grid gap-6 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,0.8fr)]"
    >
      <input type="hidden" name="client_id" value={data.clientId} />
      <input type="hidden" name="oauth_query" value={submittedOauthQuery} />
      <input
        type="hidden"
        name="organization_id"
        value={selectedOrganizationId}
      />

      <Card class="border-border/70">
        <CardHeader class="space-y-3">
          <div class="flex items-center justify-between gap-4">
            <div>
              <CardTitle>Access target</CardTitle>
              <CardDescription>
                Pick the organization and apps this client can query.
              </CardDescription>
            </div>

            {#if selectedOrganization}
              <Badge variant="outline">{selectedOrganization.slug}</Badge>
            {/if}
          </div>
        </CardHeader>

        <CardContent class="space-y-6">
          <div class="grid gap-2">
            <Label for="oauth-organization">Organization</Label>
            <Select.Root
              type="single"
              value={selectedOrganizationId}
              onValueChange={(value) => {
                selectedOrganizationId = typeof value === "string" ? value : "";
              }}
            >
              <Select.Trigger id="oauth-organization" class="bg-background">
                {selectedOrganization?.name ?? "Select an organization"}
              </Select.Trigger>
              <Select.Content>
                {#each data.organizations as organization}
                  <Select.Item
                    value={organization.id}
                    label={organization.name}
                  />
                {/each}
              </Select.Content>
            </Select.Root>
          </div>

          <Separator />

          <div class="space-y-3">
            <div class="flex items-center justify-between gap-3">
              <div class="space-y-1">
                <Label>Allowed apps</Label>
                <p class="text-sm text-muted-foreground">
                  Only these apps will be available to the client.
                </p>
              </div>

              {#if apps.length > 0}
                <Badge variant="secondary">
                  {selectedAppIds.length}/{apps.length} selected
                </Badge>
              {/if}
            </div>

            {#if apps.length === 0}
              <div
                class="rounded-2xl border border-dashed bg-muted/20 px-4 py-6 text-sm text-muted-foreground"
              >
                This organization has no apps to authorize yet.
              </div>
            {:else}
              <div class="grid gap-3">
                {#each apps as app}
                  <label
                    class="flex items-start justify-between gap-4 rounded-2xl border bg-background px-4 py-3 transition-colors hover:bg-muted/30"
                  >
                    <div class="flex min-w-0 items-start gap-3">
                      <Checkbox
                        checked={selectedAppIds.includes(app.id)}
                        onCheckedChange={(checked) =>
                          toggleApp(app.id, Boolean(checked))}
                      />
                      <div class="min-w-0 space-y-1">
                        <p class="text-sm font-medium text-foreground">
                          {app.name}
                        </p>
                        <p class="truncate text-xs text-muted-foreground">
                          {app.id}
                        </p>
                      </div>
                    </div>

                    <input
                      type="hidden"
                      disabled={!selectedAppIds.includes(app.id)}
                      name="allowed_app_id"
                      value={app.id}
                    />
                  </label>
                {/each}
              </div>
            {/if}
          </div>
        </CardContent>
      </Card>

      <div class="space-y-6">
        <Card class="border-border/70">
          <CardHeader>
            <CardTitle>Requested MCP scopes</CardTitle>
            <CardDescription>
              These permissions will apply to the selected apps.
            </CardDescription>
          </CardHeader>

          <CardContent>
            <div class="grid gap-2">
              {#each toolScopes as scope}
                <div class="rounded-xl border bg-muted/20 px-3 py-3">
                  <p class="text-sm font-medium text-foreground">
                    {scopeLabels[scope] ?? scope}
                  </p>
                  <p class="mt-1 text-xs text-muted-foreground">{scope}</p>
                </div>
              {/each}
            </div>
          </CardContent>
        </Card>

        {#if identityScopes.length > 0}
          <Card class="border-border/70">
            <CardHeader>
              <CardTitle>Identity scopes</CardTitle>
              <CardDescription>
                These are used for the OAuth session itself.
              </CardDescription>
            </CardHeader>

            <CardContent>
              <div class="flex flex-wrap gap-2">
                {#each identityScopes as scope}
                  <Badge variant="outline">
                    {scopeLabels[scope] ?? scope}
                  </Badge>
                {/each}
              </div>
            </CardContent>
          </Card>
        {/if}

        <Card class="border-border/70">
          <CardContent class="space-y-4 p-6">
            {#if form?.error || data.error}
              <div
                class="rounded-xl border border-destructive/20 bg-destructive/5 px-3 py-2 text-sm text-destructive"
              >
                {form?.error ?? data.error}
              </div>
            {/if}

            <div class="space-y-1 text-sm text-muted-foreground">
              <p>
                You can revoke or rotate this access later from organization
                settings.
              </p>
            </div>

            <div class="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
              <Button
                type="submit"
                name="decision"
                value="deny"
                variant="outline"
              >
                Deny
              </Button>
              <Button type="submit" name="decision" value="approve">
                Allow access
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </form>
  </div>
</div>
