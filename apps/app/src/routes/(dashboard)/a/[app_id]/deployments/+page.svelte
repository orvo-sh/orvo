<script lang="ts">
  import { page } from "$app/state";
  import { PUBLIC_ORVO_OTLP_BASE_URL } from "$env/static/public";
  import { formatNumber } from "@repo/utils";
  import { Badge } from "@repo/components/ui/badge";
  import { Button } from "@repo/components/ui/button";
  import { Input } from "@repo/components/ui/input";
  import * as Select from "@repo/components/ui/select";
  import {
    IconBrandGithub,
    IconChevronRight,
    IconClock,
    IconExternalLink,
    IconGitBranch,
    IconRocket,
    IconSearch,
    IconUser,
  } from "@tabler/icons-svelte";
  import PageContainer from "../_components/page-container/page-container.svelte";

  let { data } = $props();

  let search = $state("");
  let statusFilter = $state("all");
  let environmentFilter = $state("all");

  const deploymentEndpoint = new URL(
    "/v1/deployments",
    PUBLIC_ORVO_OTLP_BASE_URL || "https://ingest.orvo.sh",
  ).toString();

  const error = $derived(
    data.deploymentsResult.success ? "" : data.deploymentsResult.error,
  );
  const deployments = $derived(
    data.deploymentsResult.success
      ? data.deploymentsResult.data.deployments
      : [],
  );

  const environments = $derived([
    "all",
    ...Array.from(
      new Set(deployments.map((deployment) => deployment.environmentName)),
    ).sort(),
  ]);

  const filteredDeployments = $derived.by(() => {
    const query = search.trim().toLowerCase();

    return deployments.filter((deployment) => {
      const matchesSearch =
        !query ||
        [
          deployment.serviceName,
          deployment.environmentName,
          deployment.version,
          deployment.gitSha,
          deployment.gitBranch,
          deployment.gitRepository,
          deployment.gitActor,
          deployment.commitMessage,
        ]
          .filter(Boolean)
          .some((value) => value!.toLowerCase().includes(query));

      return (
        matchesSearch &&
        (statusFilter === "all" || deployment.status === statusFilter) &&
        (environmentFilter === "all" ||
          deployment.environmentName === environmentFilter)
      );
    });
  });

  const stats = $derived({
    total: deployments.length,
    succeeded: deployments.filter(
      (deployment) => deployment.status === "succeeded",
    ).length,
    failed: deployments.filter((deployment) => deployment.status === "failed")
      .length,
    services: new Set(deployments.map((deployment) => deployment.serviceName))
      .size,
  });

  const latestDeployment = $derived(deployments[0] ?? null);

  const statusLabels = {
    pending: "Pending",
    in_progress: "In progress",
    succeeded: "Succeeded",
    failed: "Failed",
    rolled_back: "Rolled back",
  } as const;

  const statusClasses = {
    pending: "border-border text-muted-foreground",
    in_progress:
      "border-blue-500/30 bg-blue-500/10 text-blue-700 dark:text-blue-300",
    succeeded:
      "border-green-500/30 bg-green-500/10 text-green-700 dark:text-green-300",
    failed: "border-destructive/30 bg-destructive/10 text-destructive",
    rolled_back:
      "border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-300",
  } as const;

  const statusFilterLabel = $derived(
    statusFilter === "all"
      ? "All statuses"
      : statusFilter === "pending"
        ? "Pending"
        : statusFilter === "in_progress"
          ? "In progress"
          : statusFilter === "succeeded"
            ? "Succeeded"
            : statusFilter === "failed"
              ? "Failed"
              : "Rolled back",
  );

  const environmentFilterLabel = $derived(
    environmentFilter === "all" ? "All environments" : environmentFilter,
  );

  const shortSha = (sha: string | null) => sha?.slice(0, 7) ?? "No SHA";

  const formatDate = (value: Date | string | null) => {
    if (!value) {
      return "Not set";
    }

    return new Intl.DateTimeFormat(undefined, {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    }).format(new Date(value));
  };

  const formatDuration = (
    startedAt: Date | string,
    finishedAt: Date | string | null,
  ) => {
    if (!finishedAt) {
      return "In progress";
    }

    const durationMs = Math.max(
      new Date(finishedAt).getTime() - new Date(startedAt).getTime(),
      0,
    );
    const minutes = Math.floor(durationMs / 60000);
    const seconds = Math.floor((durationMs % 60000) / 1000);

    return minutes === 0 ? `${seconds}s` : `${minutes}m ${seconds}s`;
  };
</script>

<PageContainer title="Deployments">
  {#snippet actions()}
    <Button
      href={`/a/${page.params.app_id}/settings/ingest-keys`}
      variant="outline"
    >
      <IconRocket data-slot="button-icon" />
      Setup private key
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

    {#if deployments.length === 0}
      <section class="rounded-xl border bg-background">
        <div class="flex flex-col gap-6 px-5 py-8 sm:px-6">
          <div
            class="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between"
          >
            <div class="space-y-1.5">
              <div
                class="inline-flex size-11 items-center justify-center rounded-xl border bg-secondary"
              >
                <IconRocket class="size-5 text-muted-foreground" />
              </div>
              <div class="space-y-1">
                <h2 class="text-lg font-semibold tracking-tight">
                  Track deployment health
                </h2>
                <p class="max-w-2xl text-sm text-muted-foreground">
                  Send deployment events to Orvo with your private ingestion
                  key. We will correlate the release with logs and traces so the
                  deployments view can show what changed after each rollout.
                </p>
              </div>
            </div>

            <Button
              href={`/a/${page.params.app_id}/settings/ingest-keys`}
              variant="outline"
            >
              <IconRocket data-slot="button-icon" />
              View private key
            </Button>
          </div>

          <div class="grid gap-3 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
            <div class="rounded-xl border bg-secondary px-4 py-4">
              <p
                class="text-xs font-medium tracking-wide text-muted-foreground uppercase"
              >
                Endpoint
              </p>
              <code class="mt-2 block overflow-x-auto text-sm text-foreground">
                POST {deploymentEndpoint}
              </code>
            </div>

            <div class="rounded-xl border bg-secondary px-4 py-4">
              <p
                class="text-xs font-medium tracking-wide text-muted-foreground uppercase"
              >
                Auth header
              </p>
              <code class="mt-2 block overflow-x-auto text-sm text-foreground">
                Authorization: Bearer sk_...
              </code>
            </div>
          </div>

          <div class="rounded-xl border bg-secondary px-4 py-4">
            <p
              class="text-xs font-medium tracking-wide text-muted-foreground uppercase"
            >
              Example
            </p>
            <pre
              class="mt-3 overflow-x-auto text-sm leading-6 text-foreground"><code
                >{`curl -X POST '${deploymentEndpoint}' \\
  -H 'Authorization: Bearer sk_...' \\
  -H 'Content-Type: application/json' \\
  -d '{
    "serviceName": "api",
    "environmentName": "production",
    "version": "2026.06.16",
    "status": "succeeded",
    "gitSha": "abc1234",
    "gitBranch": "main"
  }'`}</code
              ></pre>
          </div>
        </div>
      </section>
    {:else}
      <section class="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <div class="rounded-xl border bg-background px-4 py-3">
          <p class="text-xs text-muted-foreground">Total deployments</p>
          <p class="mt-1 text-2xl font-semibold tabular-nums">
            {formatNumber(stats.total, 0)}
          </p>
        </div>
        <div class="rounded-xl border bg-background px-4 py-3">
          <p class="text-xs text-muted-foreground">Succeeded</p>
          <p
            class="mt-1 text-2xl font-semibold text-green-600 tabular-nums dark:text-green-400"
          >
            {formatNumber(stats.succeeded, 0)}
          </p>
        </div>
        <div class="rounded-xl border bg-background px-4 py-3">
          <p class="text-xs text-muted-foreground">Failed</p>
          <p class="mt-1 text-2xl font-semibold text-destructive tabular-nums">
            {formatNumber(stats.failed, 0)}
          </p>
        </div>
        <div class="rounded-xl border bg-background px-4 py-3">
          <p class="text-xs text-muted-foreground">Latest service</p>
          <p class="mt-1 truncate text-sm font-medium">
            {latestDeployment?.serviceName ?? "No service"}
          </p>
          <p class="mt-1 text-xs text-muted-foreground">
            {stats.services}
            {stats.services === 1 ? "service" : "services"}
          </p>
        </div>
      </section>

      <section class="overflow-hidden rounded-xl border bg-background">
        <div
          class="flex flex-col gap-3 border-b bg-secondary px-3 py-3 lg:flex-row lg:items-center"
        >
          <div class="relative min-w-0 flex-1">
            <IconSearch
              class="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground"
            />
            <Input
              bind:value={search}
              class="bg-background pl-9"
              placeholder="Search deployments"
            />
          </div>

          <div class="flex flex-wrap items-center gap-2">
            <Select.Root type="single" bind:value={environmentFilter}>
              <Select.Trigger class="bg-background">
                {environmentFilterLabel}
              </Select.Trigger>
              <Select.Content>
                {#each environments as environment}
                  <Select.Item
                    value={environment}
                    label={environment === "all"
                      ? "All environments"
                      : environment}
                  />
                {/each}
              </Select.Content>
            </Select.Root>

            <Select.Root type="single" bind:value={statusFilter}>
              <Select.Trigger class="bg-background">
                {statusFilterLabel}
              </Select.Trigger>
              <Select.Content>
                <Select.Item value="all" label="All statuses" />
                <Select.Item value="pending" label="Pending" />
                <Select.Item value="in_progress" label="In progress" />
                <Select.Item value="succeeded" label="Succeeded" />
                <Select.Item value="failed" label="Failed" />
                <Select.Item value="rolled_back" label="Rolled back" />
              </Select.Content>
            </Select.Root>
          </div>
        </div>

        <div class="divide-y">
          {#each filteredDeployments as deployment (deployment.id)}
            <a
              href={`/a/${page.params.app_id}/deployments/${deployment.id}`}
              class="grid gap-3 px-4 py-4 transition-colors hover:bg-muted/40 lg:grid-cols-[minmax(180px,1fr)_minmax(140px,0.7fr)_minmax(180px,1fr)_minmax(150px,0.7fr)_24px] lg:items-center"
            >
              <div class="min-w-0">
                <div class="flex min-w-0 items-center gap-2">
                  <Badge
                    variant="outline"
                    class={statusClasses[deployment.status]}
                  >
                    {statusLabels[deployment.status]}
                  </Badge>
                  <p class="truncate text-sm font-medium">
                    {deployment.serviceName}
                  </p>
                </div>
                <p class="mt-1 truncate text-xs text-muted-foreground">
                  {deployment.environmentName} · {deployment.version ??
                    "No version"}
                </p>
              </div>

              <div
                class="flex min-w-0 items-center gap-2 text-sm text-muted-foreground"
              >
                <IconClock class="size-4 shrink-0" />
                <span class="truncate">{formatDate(deployment.startedAt)}</span>
              </div>

              <div class="min-w-0 text-sm">
                <div class="flex min-w-0 items-center gap-2">
                  <IconBrandGithub
                    class="size-4 shrink-0 text-muted-foreground"
                  />
                  <span class="truncate font-mono text-xs"
                    >{shortSha(deployment.gitSha)}</span
                  >
                  {#if deployment.gitBranch}
                    <span
                      class="inline-flex min-w-0 items-center gap-1 text-xs text-muted-foreground"
                    >
                      <IconGitBranch class="size-3.5 shrink-0" />
                      <span class="truncate">{deployment.gitBranch}</span>
                    </span>
                  {/if}
                </div>
                <p class="mt-1 truncate text-xs text-muted-foreground">
                  {deployment.commitMessage ??
                    deployment.gitRepository ??
                    "No commit metadata"}
                </p>
              </div>

              <div
                class="flex min-w-0 items-center justify-between gap-2 text-sm text-muted-foreground"
              >
                <span class="inline-flex min-w-0 items-center gap-1">
                  <IconUser class="size-4 shrink-0" />
                  <span class="truncate"
                    >{deployment.gitActor ?? "Unknown actor"}</span
                  >
                </span>
                <span class="shrink-0 text-xs">
                  {formatDuration(deployment.startedAt, deployment.finishedAt)}
                </span>
                {#if deployment.externalUrl}
                  <IconExternalLink class="size-4 shrink-0" />
                {/if}
              </div>

              <IconChevronRight
                class="hidden size-4 text-muted-foreground lg:block"
              />
            </a>
          {:else}
            <div class="px-4 py-12 text-center text-sm text-muted-foreground">
              No deployments match these filters.
            </div>
          {/each}
        </div>
      </section>
    {/if}
  </div>
</PageContainer>
