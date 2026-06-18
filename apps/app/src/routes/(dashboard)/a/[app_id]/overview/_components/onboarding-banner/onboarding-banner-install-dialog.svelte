<script lang="ts">
  import { Button } from "@repo/components/ui/button";
  import * as Dialog from "@repo/components/ui/dialog";
  import { toast } from "@repo/components/ui/sonner";
  import * as Tabs from "@repo/components/ui/tabs";
  import { IconCopy, IconExternalLink } from "@tabler/icons-svelte";
  import type { Snippet } from "svelte";
  import { tabs } from "./onboarding-banner-install-snippets.ts";
  import { highlightCode } from "./syntax-highlight";

  let {
    ingestionKey,
    class: className,
    children,
  }: {
    ingestionKey: string;
    class?: string;
    children?: Snippet;
  } = $props();

  let open = $state(false);

  function copy(text: string) {
    window.navigator?.clipboard
      .writeText(text)
      .then(() => {
        toast.success("Copied to clipboard");
      })
      .catch(() => {
        toast.error("Failed to copy");
      });
  }
</script>

<Dialog.Root bind:open>
  <Dialog.Trigger class={className}>
    {@render children?.()}
  </Dialog.Trigger>
  <Dialog.Content class="sm:max-w-5xl">
    <Dialog.Header class="py-2">
      <Dialog.Title>Installing OpenTelemetry</Dialog.Title>
      <Dialog.Description>
        Choose your language and follow the steps to start sending telemetry.
        Have a different setup? See
        <a
          href="https://orvo.sh/docs/quickstart"
          class="inline-flex items-center font-medium text-foreground underline underline-offset-2 hover:text-foreground/80"
          target="_blank"
          rel="noopener noreferrer"
        >
          our installation docs
          <IconExternalLink class="ml-1 inline-block size-3.5" />
        </a>
      </Dialog.Description>
    </Dialog.Header>

    <Tabs.Root value="node" class="mt-2">
      <Tabs.List variant="line" class="w-full border-b">
        {#each tabs as tab}
          <Tabs.Trigger value={tab.value} class="gap-1.5">
            <tab.icon class="size-4" />
            {tab.label}
          </Tabs.Trigger>
        {/each}
      </Tabs.List>

      {#each tabs as tab}
        <Tabs.Content value={tab.value} class="mt-2 min-w-0 space-y-4">
          <div class="space-y-1.5">
            <p class="text-sm font-medium text-secondary-foreground">
              1. Install dependencies
            </p>
            <div class="relative">
              <Button
                variant="secondary"
                size="icon-sm"
                class="absolute top-1.5 right-1.5 bg-secondary/60"
                onclick={() => copy(tab.install)}
              >
                <IconCopy data-slot="button-icon" class="size-3.5" />
              </Button>
              <pre
                class="code-block w-full max-w-full rounded-lg bg-zinc-900 px-4 py-4 text-xs whitespace-pre-wrap text-zinc-50"><code
                  >{@html highlightCode(
                    tab.install,
                    tab.value === "java" ? "java" : "bash",
                  )}</code
                ></pre>
            </div>
          </div>

          <p class="text-muted-foreground">
            {tab.body}
          </p>

          <div class="space-y-1.5">
            <p class="text-sm font-medium text-secondary-foreground">
              2. Configure the exporter
            </p>
            <div class="relative">
              <Button
                variant="secondary"
                size="icon-sm"
                class="absolute top-1.5 right-1.5 bg-secondary/60"
                onclick={() => copy(tab.snippet)}
              >
                <IconCopy data-slot="button-icon" class="size-3.5" />
              </Button>
              <pre
                class="code-block w-full max-w-full rounded-lg bg-zinc-900 px-4 py-4 text-xs whitespace-pre-wrap text-zinc-50"><code
                  >{@html highlightCode(
                    tab.snippet.replaceAll("YOUR_KEY", ingestionKey),
                    tab.value,
                  )}</code
                ></pre>
            </div>
          </div>
        </Tabs.Content>
      {/each}
    </Tabs.Root>
  </Dialog.Content>
</Dialog.Root>

<style>
  .code-block :global(.token-keyword) {
    color: #cc99cd;
  }
  .code-block :global(.token-string) {
    color: #7ec699;
  }
  .code-block :global(.token-comment) {
    color: #999999;
  }
  .code-block :global(.token-number) {
    color: #f08d49;
  }
  .code-block :global(.token-class-name) {
    color: #f8c555;
  }
  .code-block :global(.token-builtin) {
    color: #67cdcc;
  }
  .code-block :global(.token-function) {
    color: #f08d49;
  }
</style>
