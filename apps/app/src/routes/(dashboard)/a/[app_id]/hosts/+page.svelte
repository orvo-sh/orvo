<script lang="ts">
  import { invalidateAll } from "$app/navigation";
  import { page } from "$app/state";
  import { createHostInstallSessionCommand } from "$lib/api/host-monitoring.remote";
  import { Badge } from "@repo/components/ui/badge";
  import { Button } from "@repo/components/ui/button";
  import { Input } from "@repo/components/ui/input";
  import { toast } from "@repo/components/ui/sonner";
  import {
    IconArrowRight,
    IconBox,
    IconCopy,
    IconRefresh,
    IconServer,
    IconSettings,
  } from "@tabler/icons-svelte";
  import PageContainer from "../../../_components/page-container/page-container.svelte";

  let { data } = $props();

  let error = $state("");
  let search = $state("");
  let dockerEnabled = $state(false);
  let generatingInstall = $state(false);
  let refreshing = $state(false);
  let installError = $state("");
  let installSession = $state<{
    command: string;
    installerUrl: string;
    bundleUrl: string;
    expiresAt: string;
    dockerEnabled: boolean;
  } | null>(null);

  const hosts = $derived(
    data.hostsResult.success ? data.hostsResult.data.hosts : [],
  );
  const summary = $derived(
    data.hostsResult.success
      ? data.hostsResult.data.summary
      : {
          totalHosts: 0,
          healthyHosts: 0,
          staleHosts: 0,
          alertingHosts: 0,
          reportingContainers: 0,
        },
  );

  $effect(() => {
    error = data.hostsResult.success ? "" : data.hostsResult.error;
  });

  const filteredHosts = $derived.by(() => {
    const query = search.trim().toLowerCase();

    if (!query) {
      return hosts;
    }

    return hosts.filter((host) =>
      [host.hostName, host.hostId, host.osType, host.hostArch]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()
        .includes(query),
    );
  });

  const statusClasses = {
    healthy:
      "border-green-500/30 bg-green-500/10 text-green-700 dark:text-green-300",
    stale:
      "border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-300",
    alerting: "border-destructive/30 bg-destructive/10 text-destructive",
  } as const;

  const formatPercent = (value: number | null) =>
    value === null ? "—" : `${value.toFixed(value >= 10 ? 0 : 1)}%`;

  const formatLastSeen = (value: string) =>
    new Intl.DateTimeFormat(undefined, {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    }).format(new Date(value));

  const copy = async (value: string) => {
    try {
      await navigator.clipboard.writeText(value);
      toast.success("Copied to clipboard");
    } catch {
      toast.error("Failed to copy");
    }
  };

  const generateInstallCommand = async () => {
    generatingInstall = true;
    installError = "";

    const result = await createHostInstallSessionCommand({ dockerEnabled });
    if (!result.success) {
      installError = result.error;
      generatingInstall = false;
      return;
    }

    installSession = result.data;
    generatingInstall = false;
  };

  const refresh = async () => {
    refreshing = true;
    await invalidateAll();
    refreshing = false;
  };
</script>

<PageContainer title="Hosts">
  {#snippet actions()}
    <Button variant="outline" loading={refreshing} onclick={refresh}>
      <IconRefresh data-slot="button-icon" />
      Refresh
    </Button>
  {/snippet}

  <div class="mx-auto flex w-full max-w-6xl flex-col gap-5">
    {#if error}
      <div
        class="rounded-lg border border-destructive/20 bg-destructive/5 px-4 py-3 text-sm text-destructive"
      >
        {error}
      </div>
    {/if}

    <section class="grid gap-3 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
      <div class="rounded-xl border bg-background p-5">
        <div class="flex items-start justify-between gap-4">
          <div class="space-y-1">
            <p class="text-sm font-medium">Install host monitoring</p>
            <p class="max-w-xl text-sm text-muted-foreground">
              The install script lives in <code>packages/host-agent</code>, gets
              published to
              <code>cdn.orvo.sh</code>, and pulls a short-lived app-specific
              bundle from this app.
            </p>
          </div>
          <div class="rounded-lg border bg-muted/40 p-2">
            <IconServer class="size-5 text-muted-foreground" />
          </div>
        </div>

        <div class="mt-4 flex flex-wrap gap-2">
          <Button
            type="button"
            variant={dockerEnabled ? "outline" : "default"}
            onclick={() => {
              dockerEnabled = false;
            }}
          >
            Linux host
          </Button>
          <Button
            type="button"
            variant={dockerEnabled ? "default" : "outline"}
            onclick={() => {
              dockerEnabled = true;
            }}
          >
            Linux + Docker
          </Button>
          <Button loading={generatingInstall} onclick={generateInstallCommand}>
            <IconSettings data-slot="button-icon" />
            Generate install command
          </Button>
        </div>

        {#if installError}
          <div
            class="mt-4 rounded-lg border border-destructive/20 bg-destructive/5 px-4 py-3 text-sm text-destructive"
          >
            {installError}
          </div>
        {/if}

        {#if installSession}
          <div class="mt-4 grid gap-3">
            <div class="rounded-xl border bg-muted/20">
              <div class="flex items-center justify-between border-b px-4 py-3">
                <div>
                  <p class="text-sm font-medium">Run this on the host</p>
                  <p class="text-xs text-muted-foreground">
                    Bundle expires {new Date(
                      installSession.expiresAt,
                    ).toLocaleString()}.
                  </p>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onclick={() => copy(installSession!.command)}
                >
                  <IconCopy data-slot="button-icon" />
                  Copy
                </Button>
              </div>
              <pre
                class="overflow-x-auto px-4 py-4 font-mono text-xs text-foreground"><code
                  >{installSession.command}</code
                ></pre>
            </div>

            <div
              class="grid gap-2 text-xs text-muted-foreground sm:grid-cols-2"
            >
              <div class="rounded-lg border px-3 py-2">
                <p class="font-medium text-foreground">Installer</p>
                <p class="mt-1 break-all">{installSession.installerUrl}</p>
              </div>
              <div class="rounded-lg border px-3 py-2">
                <p class="font-medium text-foreground">Install bundle</p>
                <p class="mt-1 break-all">{installSession.bundleUrl}</p>
              </div>
            </div>
          </div>
        {/if}
      </div>

      <div class="grid gap-3 sm:grid-cols-2 lg:grid-cols-1">
        <div class="rounded-xl border bg-background px-4 py-3">
          <p class="text-2xl font-semibold tabular-nums">
            {summary.totalHosts}
          </p>
          <p class="mt-0.5 text-xs text-muted-foreground">Reporting hosts</p>
        </div>
        <div class="rounded-xl border bg-background px-4 py-3">
          <p class="text-2xl font-semibold text-destructive tabular-nums">
            {summary.alertingHosts}
          </p>
          <p class="mt-0.5 text-xs text-muted-foreground">Alerting hosts</p>
        </div>
        <div class="rounded-xl border bg-background px-4 py-3">
          <p
            class="text-2xl font-semibold text-amber-600 tabular-nums dark:text-amber-400"
          >
            {summary.staleHosts}
          </p>
          <p class="mt-0.5 text-xs text-muted-foreground">Stale hosts</p>
        </div>
        <div class="rounded-xl border bg-background px-4 py-3">
          <p class="text-2xl font-semibold tabular-nums">
            {summary.reportingContainers}
          </p>
          <p class="mt-0.5 text-xs text-muted-foreground">
            Reporting containers
          </p>
        </div>
      </div>
    </section>

    {#if hosts.length > 0}
      <div class="relative">
        <Input bind:value={search} class="pl-3" placeholder="Search hosts..." />
      </div>
    {/if}

    {#if hosts.length === 0}
      <div
        class="flex flex-col items-center gap-4 rounded-xl border border-dashed px-4 py-16 text-center"
      >
        <div class="rounded-xl border bg-muted/40 p-3">
          <IconServer class="size-6 text-muted-foreground" />
        </div>
        <div class="space-y-1">
          <p class="text-sm font-medium">No hosts yet</p>
          <p class="max-w-md text-sm text-muted-foreground">
            Generate an install command, run it on a Linux machine, and this
            screen will populate automatically when the collector starts sending
            host metrics.
          </p>
        </div>
      </div>
    {:else if filteredHosts.length === 0}
      <div
        class="rounded-xl border border-dashed px-4 py-10 text-center text-sm text-muted-foreground"
      >
        No hosts match this search.
      </div>
    {:else}
      <section class="divide-y overflow-hidden rounded-xl border bg-background">
        {#each filteredHosts as host (host.hostId)}
          <a
            href={`/a/${page.params.app_id}/hosts/${host.hostId}`}
            class="grid gap-3 px-4 py-4 transition-colors hover:bg-muted/30 lg:grid-cols-[minmax(240px,1.2fr)_repeat(4,minmax(110px,0.6fr))_24px] lg:items-center"
          >
            <div class="min-w-0">
              <div class="flex min-w-0 items-center gap-2">
                <p class="truncate text-sm font-medium">{host.hostName}</p>
                <Badge variant="outline" class={statusClasses[host.status]}>
                  {host.status}
                </Badge>
              </div>
              <p class="mt-1 truncate text-xs text-muted-foreground">
                {host.osType ?? "Unknown OS"}{host.hostArch
                  ? ` · ${host.hostArch}`
                  : ""} ·
                {host.hostId}
              </p>
            </div>

            <div>
              <p class="text-xs text-muted-foreground">CPU</p>
              <p class="text-sm font-medium tabular-nums">
                {formatPercent(host.cpuUtilization)}
              </p>
            </div>

            <div>
              <p class="text-xs text-muted-foreground">Memory</p>
              <p class="text-sm font-medium tabular-nums">
                {formatPercent(host.memoryUtilization)}
              </p>
            </div>

            <div>
              <p class="text-xs text-muted-foreground">Filesystem</p>
              <p class="text-sm font-medium tabular-nums">
                {formatPercent(host.filesystemUtilization)}
              </p>
            </div>

            <div>
              <p class="text-xs text-muted-foreground">Containers</p>
              <p
                class="inline-flex items-center gap-1 text-sm font-medium tabular-nums"
              >
                <IconBox class="size-4 text-muted-foreground" />
                {host.containerCount}
              </p>
            </div>

            <div>
              <p class="text-xs text-muted-foreground">Last seen</p>
              <p class="text-sm font-medium">{formatLastSeen(host.lastSeen)}</p>
            </div>

            <IconArrowRight
              class="hidden size-4 text-muted-foreground lg:block"
            />
          </a>
        {/each}
      </section>
    {/if}
  </div>
</PageContainer>
