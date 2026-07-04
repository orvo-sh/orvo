<script lang="ts">
  import { invalidateAll } from "$app/navigation";
  import { page } from "$app/state";
  import {
    createMcpTokenCommand,
    listMcpTokensQuery,
    revokeMcpTokenCommand,
  } from "$lib/api/mcp-tokens.remote";
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
  import * as Dialog from "@repo/components/ui/dialog";
  import { Input } from "@repo/components/ui/input";
  import { Label } from "@repo/components/ui/label";
  import * as Select from "@repo/components/ui/select";
  import { toast } from "@repo/components/ui/sonner";
  import { Textarea } from "@repo/components/ui/textarea";
  import {
    IconCheck,
    IconCopy,
    IconKey,
    IconPlus,
    IconServer,
    IconTrash,
  } from "@tabler/icons-svelte";
  import { onMount } from "svelte";
  import type { PageData } from "./$types";

  let { data }: { data: PageData } = $props();

  const scopeOptions = [
    { value: "app:read", label: "App read" },
    { value: "app:write", label: "App write" },
    { value: "logs:read", label: "Logs read" },
    { value: "traces:read", label: "Traces read" },
    { value: "metrics:read", label: "Metrics read" },
    { value: "incidents:read", label: "Incidents read" },
    { value: "incidents:write", label: "Incidents write" },
    { value: "heartbeats:read", label: "Heartbeats read" },
    { value: "heartbeats:write", label: "Heartbeats write" },
    { value: "alerts:read", label: "Alerts read" },
    { value: "alerts:write", label: "Alerts write" },
  ] as const;

  const scopePresets = {
    read_only: [
      "app:read",
      "logs:read",
      "traces:read",
      "metrics:read",
      "incidents:read",
      "heartbeats:read",
      "alerts:read",
    ],
    incident_operator: [
      "app:read",
      "logs:read",
      "traces:read",
      "metrics:read",
      "incidents:read",
      "incidents:write",
      "heartbeats:read",
      "heartbeats:write",
      "alerts:read",
    ],
    full_app_access: scopeOptions.map((scope) => scope.value),
    custom: [] as string[],
  } as const;

  const defaultAllowedAppIds = data.currentApp?.id
    ? [data.currentApp.id]
    : data.apps.slice(0, 1).map((app) => app.id);

  let loading = $state(true);
  let error = $state("");
  let tokens = $state<
    Array<{
      id: string;
      name: string;
      description: string;
      tokenPrefix: string;
      scopes: string[];
      allowedAppIds: string[];
      createdAt: Date | string;
      lastUsedAt: Date | string | null;
      lastUsedIp: string | null;
      lastUsedUserAgent: string | null;
      expiresAt: Date | string | null;
      revokedAt: Date | string | null;
    }>
  >([]);

  let dialogOpen = $state(false);
  let creating = $state(false);
  let revokingId = $state("");
  let createdToken = $state("");
  let tokenName = $state("");
  let tokenDescription = $state("");
  let scopePreset = $state<keyof typeof scopePresets>("read_only");
  let selectedScopes = $state<string[]>([...scopePresets.read_only]);
  let selectedAppIds = $state<string[]>([...defaultAllowedAppIds]);
  let expiry = $state("90");

  const endpoint = $derived(`${page.url.origin}/api/mcp`);
  const installServerName = $derived(
    `orvo-${
      (data.currentOrganization?.name ?? "organization")
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "") || "organization"
    }`,
  );
  const installSnippet = $derived(
    JSON.stringify(
      {
        mcpServers: {
          [installServerName]: {
            url: endpoint,
            headers: {
              Authorization: "Bearer orvo_mcp_...",
            },
          },
        },
      },
      null,
      2,
    ),
  );

  const loadTokens = async () => {
    loading = true;
    error = "";

    const result = await listMcpTokensQuery({ includeRevoked: true });

    if (!result.success) {
      error = result.error;
      loading = false;
      return;
    }

    tokens = result.data.tokens;
    loading = false;
  };

  const resetDialog = () => {
    createdToken = "";
    tokenName = "";
    tokenDescription = "";
    scopePreset = "read_only";
    selectedScopes = [...scopePresets.read_only];
    selectedAppIds = [...defaultAllowedAppIds];
    expiry = "90";
    error = "";
  };

  const copy = async (value: string, label: string) => {
    await navigator.clipboard.writeText(value);
    toast.success(`${label} copied.`);
  };

  const applyPreset = (value: keyof typeof scopePresets) => {
    scopePreset = value;
    selectedScopes = [...scopePresets[value]];
  };

  const toggleScope = (scope: string, checked: boolean) => {
    scopePreset = "custom";
    selectedScopes = checked
      ? [...new Set([...selectedScopes, scope])]
      : selectedScopes.filter((value) => value !== scope);
  };

  const toggleAllowedApp = (appId: string, checked: boolean) => {
    selectedAppIds = checked
      ? [...new Set([...selectedAppIds, appId])]
      : selectedAppIds.filter((value) => value !== appId);
  };

  const getScopePresetLabel = () =>
    scopePreset === "read_only"
      ? "Read-only recommended"
      : scopePreset === "incident_operator"
        ? "Incident operator"
        : scopePreset === "full_app_access"
          ? "Full app access"
          : "Custom...";

  const getAllowedAppNames = (allowedAppIds: string[]) =>
    data.apps
      .filter((app) => allowedAppIds.includes(app.id))
      .map((app) => app.name);

  const createToken = async () => {
    error = "";

    if (tokenName.trim().length === 0) {
      error = "Name is required.";
      return;
    }

    if (selectedAppIds.length === 0) {
      error = "Select at least one allowed app.";
      return;
    }

    if (selectedScopes.length === 0) {
      error = "Select at least one scope.";
      return;
    }

    creating = true;

    const result = await createMcpTokenCommand({
      name: tokenName.trim(),
      description: tokenDescription.trim(),
      scopes: selectedScopes as Array<(typeof scopeOptions)[number]["value"]>,
      allowedAppIds: selectedAppIds,
      expiresInDays: expiry === "never" ? null : Number(expiry),
    });

    creating = false;

    if (!result.success) {
      error = result.error;
      return;
    }

    createdToken = result.data.token;
    await invalidateAll();
    await loadTokens();
    toast.success("MCP token created.");
  };

  const revokeToken = async (id: string) => {
    revokingId = id;

    const result = await revokeMcpTokenCommand({ id });
    revokingId = "";

    if (!result.success) {
      toast.error(result.error);
      return;
    }

    await invalidateAll();
    await loadTokens();
    toast.success("MCP token revoked.");
  };

  onMount(() => {
    void loadTokens();
  });
</script>

<div class="flex w-full max-w-5xl flex-col gap-8">
  <Card>
    <CardHeader class="gap-1">
      <CardTitle>MCP endpoint</CardTitle>
      <CardDescription>
        Use the organization MCP endpoint with streamable HTTP. Each token can
        be limited to selected apps and explicit scopes.
      </CardDescription>
    </CardHeader>
    <CardContent class="space-y-5">
      <div class="grid gap-4 md:grid-cols-2">
        <div class="space-y-2">
          <Label class="text-sm font-medium">Endpoint</Label>
          <div
            class="flex flex-wrap items-center gap-2 rounded-lg border bg-background p-3"
          >
            <code class="min-w-0 flex-1 truncate text-sm">{endpoint}</code>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onclick={() => copy(endpoint, "Endpoint")}
            >
              <IconCopy data-slot="button-icon" />
              Copy
            </Button>
          </div>
        </div>

        <div class="space-y-2">
          <Label class="text-sm font-medium">Transport</Label>
          <div
            class="flex min-h-11 items-center gap-2 rounded-lg border bg-background px-4"
          >
            <IconServer class="size-4 text-muted-foreground" />
            <span class="text-sm">Streamable HTTP</span>
          </div>
        </div>
      </div>

      <div class="space-y-2">
        <Label class="text-sm font-medium">Install config</Label>
        <p class="text-sm text-muted-foreground">
          Add this config to your MCP client, then replace the bearer token with
          a real MCP token from this page.
        </p>
        <div class="rounded-lg border bg-muted/40 p-4">
          <pre
            class="overflow-x-auto text-xs leading-5 text-foreground">{installSnippet}</pre>
        </div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onclick={() => copy(installSnippet, "Install config")}
        >
          <IconCopy data-slot="button-icon" />
          Copy config
        </Button>
      </div>
    </CardContent>
  </Card>

  <Card>
    <CardHeader class="flex flex-row items-start justify-between gap-4">
      <div class="space-y-1">
        <CardTitle>MCP tokens</CardTitle>
        <CardDescription>
          Create organization tokens for MCP and future API access. Each token
          can be scoped to selected apps.
        </CardDescription>
      </div>

      <Button
        type="button"
        onclick={() => {
          resetDialog();
          dialogOpen = true;
        }}
      >
        <IconPlus data-slot="button-icon" />
        New token
      </Button>
    </CardHeader>
    <CardContent class="space-y-3">
      {#if error && !dialogOpen}
        <p class="text-sm text-destructive">{error}</p>
      {/if}

      {#if loading}
        <p class="text-sm text-muted-foreground">Loading MCP tokens...</p>
      {:else if tokens.length === 0}
        <div
          class="rounded-lg border border-dashed px-4 py-8 text-sm text-muted-foreground"
        >
          No MCP tokens yet.
        </div>
      {:else}
        {#each tokens as token (token.id)}
          <div class="space-y-4 rounded-xl border px-4 py-4">
            <div class="flex flex-wrap items-start justify-between gap-3">
              <div class="space-y-2">
                <div class="flex flex-wrap items-center gap-2">
                  <div class="flex items-center gap-2">
                    <IconKey class="size-4 text-muted-foreground" />
                    <p class="text-sm font-medium">{token.name}</p>
                  </div>

                  {#if token.revokedAt}
                    <Badge variant="secondary">Revoked</Badge>
                  {:else if token.expiresAt && new Date(token.expiresAt).getTime() <= Date.now()}
                    <Badge variant="secondary">Expired</Badge>
                  {:else}
                    <Badge>Active</Badge>
                  {/if}
                </div>

                {#if token.description}
                  <p class="text-sm text-muted-foreground">
                    {token.description}
                  </p>
                {/if}

                <p class="text-xs text-muted-foreground">
                  Created {new Date(token.createdAt).toLocaleString()}
                  {#if token.lastUsedAt}
                    · Last used {new Date(token.lastUsedAt).toLocaleString()}
                  {/if}
                  {#if token.expiresAt}
                    · Expires {new Date(token.expiresAt).toLocaleString()}
                  {/if}
                </p>

                {#if token.lastUsedIp || token.lastUsedUserAgent}
                  <p class="text-xs text-muted-foreground">
                    {token.lastUsedIp ?? "Unknown IP"}
                    {#if token.lastUsedUserAgent}
                      · {token.lastUsedUserAgent}
                    {/if}
                  </p>
                {/if}
              </div>

              <Button
                type="button"
                variant="outline"
                loading={revokingId === token.id}
                disabled={revokingId.length > 0 || !!token.revokedAt}
                onclick={() => revokeToken(token.id)}
              >
                <IconTrash data-slot="button-icon" />
                Revoke
              </Button>
            </div>

            <div
              class="flex min-h-11 items-center rounded-lg border border-input bg-background px-4"
            >
              <code class="block min-w-0 truncate text-sm text-foreground"
                >{token.tokenPrefix}</code
              >
            </div>

            <div class="space-y-2">
              <p class="text-xs font-medium text-muted-foreground">
                Allowed apps
              </p>
              <div class="flex flex-wrap gap-2">
                {#each getAllowedAppNames(token.allowedAppIds) as appName (appName)}
                  <Badge variant="outline">{appName}</Badge>
                {/each}
              </div>
            </div>

            <div class="space-y-2">
              <p class="text-xs font-medium text-muted-foreground">Scopes</p>
              <div class="flex flex-wrap gap-2">
                {#each token.scopes as scope (scope)}
                  <Badge variant="secondary">{scope}</Badge>
                {/each}
              </div>
            </div>
          </div>
        {/each}
      {/if}
    </CardContent>
  </Card>
</div>

<Dialog.Root bind:open={dialogOpen}>
  <Dialog.Content class="sm:max-w-2xl">
    <Dialog.Header>
      <Dialog.Title>New MCP token</Dialog.Title>
      <Dialog.Description>
        Create an organization-scoped bearer token. The full token is shown only
        once after creation.
      </Dialog.Description>
    </Dialog.Header>

    {#if createdToken}
      <div class="space-y-4">
        <div
          class="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900"
        >
          Token created. Store it now because it will not be shown again.
        </div>

        <div
          class="flex min-h-11 items-center rounded-lg border border-input bg-background px-4"
        >
          <code class="block min-w-0 flex-1 text-sm break-all text-foreground"
            >{createdToken}</code
          >
        </div>

        <div class="flex flex-wrap gap-2">
          <Button
            type="button"
            variant="outline"
            onclick={() => copy(createdToken, "MCP token")}
          >
            <IconCopy data-slot="button-icon" />
            Copy token
          </Button>
          <Button
            type="button"
            onclick={() => {
              dialogOpen = false;
              resetDialog();
            }}
          >
            <IconCheck data-slot="button-icon" />
            Done
          </Button>
        </div>
      </div>
    {:else}
      <div class="space-y-6">
        <div class="grid gap-4 sm:grid-cols-2">
          <div class="space-y-2">
            <Label for="token-name">Name</Label>
            <Input
              id="token-name"
              bind:value={tokenName}
              maxlength={64}
              placeholder="Production MCP client"
            />
          </div>

          <div class="space-y-2">
            <Label>Expiry</Label>
            <Select.Root type="single" bind:value={expiry}>
              <Select.Trigger class="w-full bg-background">
                {expiry === "never" ? "Never" : `${expiry} days`}
              </Select.Trigger>
              <Select.Content>
                <Select.Item value="30" label="30 days" />
                <Select.Item value="90" label="90 days" />
                <Select.Item value="365" label="365 days" />
                <Select.Item value="never" label="Never" />
              </Select.Content>
            </Select.Root>
          </div>
        </div>

        <div class="space-y-2">
          <Label for="token-description">Description</Label>
          <Textarea
            id="token-description"
            bind:value={tokenDescription}
            maxlength={240}
            placeholder="Used by the production observability client."
          />
        </div>

        <div class="space-y-3">
          <Label>Allowed apps</Label>
          <div class="grid gap-2 sm:grid-cols-2">
            {#each data.apps as app (app.id)}
              <label
                class="flex items-center gap-3 rounded-lg border px-3 py-3"
              >
                <Checkbox
                  checked={selectedAppIds.includes(app.id)}
                  onCheckedChange={(checked) =>
                    toggleAllowedApp(app.id, Boolean(checked))}
                />
                <span class="text-sm">{app.name}</span>
              </label>
            {/each}
          </div>
          <p class="text-sm text-muted-foreground">
            These apps become the allowed set for `list_apps` and all app-level
            MCP tools.
          </p>
        </div>

        <div class="space-y-3">
          <Label>Scope preset</Label>
          <Select.Root
            type="single"
            value={scopePreset}
            onValueChange={(value) =>
              applyPreset(value as keyof typeof scopePresets)}
          >
            <Select.Trigger class="w-full bg-background">
              {getScopePresetLabel()}
            </Select.Trigger>
            <Select.Content>
              <Select.Item value="read_only" label="Read-only recommended" />
              <Select.Item
                value="incident_operator"
                label="Incident operator"
              />
              <Select.Item value="full_app_access" label="Full app access" />
              <Select.Item value="custom" label="Custom..." />
            </Select.Content>
          </Select.Root>
        </div>

        {#if scopePreset === "custom"}
          <div class="space-y-3">
            <Label>Scopes</Label>
            <div class="grid gap-2 sm:grid-cols-2">
              {#each scopeOptions as scope (scope.value)}
                <label
                  class="flex items-center gap-3 rounded-lg border px-3 py-3"
                >
                  <Checkbox
                    checked={selectedScopes.includes(scope.value)}
                    onCheckedChange={(checked) =>
                      toggleScope(scope.value, Boolean(checked))}
                  />
                  <span class="text-sm">{scope.label}</span>
                </label>
              {/each}
            </div>
          </div>
        {/if}

        {#if error}
          <p class="text-sm text-destructive">{error}</p>
        {/if}
      </div>

      <Dialog.Footer>
        <Button
          type="button"
          variant="outline"
          onclick={() => {
            dialogOpen = false;
            resetDialog();
          }}
        >
          Cancel
        </Button>
        <Button type="button" loading={creating} onclick={createToken}>
          <IconPlus data-slot="button-icon" />
          Create token
        </Button>
      </Dialog.Footer>
    {/if}
  </Dialog.Content>
</Dialog.Root>
