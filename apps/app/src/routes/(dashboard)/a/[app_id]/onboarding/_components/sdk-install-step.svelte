<script lang="ts">
  import { Button } from "@repo/components/ui/button";
  import { Input } from "@repo/components/ui/input";
  import { Label } from "@repo/components/ui/label";
  import * as Tabs from "@repo/components/ui/tabs";
  import { toast } from "@repo/components/ui/sonner";
  import { IconCheck, IconCopy } from "@tabler/icons-svelte";
  import { highlightCode } from "../_lib/syntax-highlight";
  import { tabs } from "../_lib/snippets";

  const { ingestionKey }: { ingestionKey: string } = $props();

  let selected = $state("node");

  const selectedTab = $derived(
    tabs.find((tab) => tab.value === selected) ?? tabs[0],
  );

  const snippetWithKey = $derived(
    selectedTab.snippet.replaceAll("YOUR_KEY", ingestionKey || "YOUR_KEY"),
  );

  const installWithKey = $derived(
    selectedTab.install.replaceAll("YOUR_KEY", ingestionKey || "YOUR_KEY"),
  );

  const copy = async (value: string) => {
    try {
      await navigator.clipboard.writeText(value);
      toast.success("Copied to clipboard");
    } catch {
      toast.error("Failed to copy");
    }
  };
</script>

<div class="space-y-4">
  <div class="space-y-1">
    <h3 class="text-lg font-semibold">Connect your application</h3>
    <p class="text-sm text-muted-foreground">
      Pick your language, install the OpenTelemetry SDK, and start sending
      telemetry.
    </p>
  </div>

  <Tabs.Root
    value={selected}
    onValueChange={(value) => {
      if (value) selected = value;
    }}
  >
    <Tabs.List class="h-auto flex-wrap gap-1 bg-transparent p-0">
      {#each tabs as tab (tab.value)}
        <Tabs.Trigger
          value={tab.value}
          class="gap-1.5 data-[state=active]:bg-muted"
        >
          <tab.icon class="size-4" />
          {tab.label}
        </Tabs.Trigger>
      {/each}
    </Tabs.List>

    {#each tabs as tab (tab.value)}
      <Tabs.Content value={tab.value} class="mt-3 space-y-4">
        <p class="text-sm text-muted-foreground">{tab.body}</p>

        {#if tab.install}
          <div class="space-y-1.5">
            <Label class="text-xs">Install</Label>
            <div class="relative">
              <Button
                variant="secondary"
                size="icon-sm"
                class="absolute top-1.5 right-1.5 bg-secondary/60"
                onclick={() => copy(installWithKey)}
              >
                <IconCopy class="size-3.5" />
              </Button>
              <pre
                class="w-full max-w-full overflow-x-auto rounded-lg bg-zinc-900 px-4 py-4 text-xs whitespace-pre-wrap text-zinc-50"><code
                  ><!-- eslint-disable-next-line svelte/no-at-html-tags -->
                  {@html highlightCode(installWithKey, "bash")}</code
                ></pre>
            </div>
          </div>
        {/if}

        <div class="space-y-1.5">
          <Label class="text-xs">Configure and start</Label>
          <div class="relative">
            <Button
              variant="secondary"
              size="icon-sm"
              class="absolute top-1.5 right-1.5 bg-secondary/60"
              onclick={() => copy(snippetWithKey)}
            >
              <IconCopy class="size-3.5" />
            </Button>
            <pre
              class="w-full max-w-full overflow-x-auto rounded-lg bg-zinc-900 px-4 py-4 text-xs whitespace-pre-wrap text-zinc-50"><code
                ><!-- eslint-disable-next-line svelte/no-at-html-tags -->
                {@html highlightCode(snippetWithKey, tab.value)}</code
              ></pre>
          </div>
        </div>

        <div class="grid gap-3 sm:grid-cols-2">
          <div class="space-y-1.5">
            <Label class="text-xs">Ingest endpoint</Label>
            <div class="flex">
              <Input
                value="https://ingest.orvo.sh"
                readonly
                class="rounded-r-none border-r-0 bg-card"
              />
              <Button
                variant="outline"
                size="sm"
                class="h-8 rounded-l-none px-2"
                onclick={() => copy("https://ingest.orvo.sh")}
              >
                <IconCopy class="size-3.5" />
              </Button>
            </div>
          </div>

          <div class="space-y-1.5">
            <Label class="text-xs">Ingestion key</Label>
            <div class="flex">
              <Input
                value={ingestionKey
                  ? `${ingestionKey.slice(0, 8)}...`
                  : "Generate key first"}
                readonly
                class="rounded-r-none border-r-0 bg-card"
              />
              <Button
                variant="outline"
                size="sm"
                class="h-8 rounded-l-none px-2"
                disabled={!ingestionKey}
                onclick={() => copy(ingestionKey)}
              >
                <IconCopy class="size-3.5" />
              </Button>
            </div>
          </div>
        </div>
      </Tabs.Content>
    {/each}
  </Tabs.Root>

  <div class="rounded-lg border border-green-500/20 bg-green-500/5 px-4 py-3">
    <div class="flex items-start gap-3">
      <IconCheck class="mt-0.5 size-4 text-green-600 dark:text-green-400" />
      <div>
        <p class="text-sm font-medium">Waiting for telemetry</p>
        <p class="text-sm text-muted-foreground">
          Once Orvo receives a trace, log, or metric, the next step will unlock
          automatically.
        </p>
      </div>
    </div>
  </div>
</div>
