<script lang="ts">
  import { Button } from "@repo/components/ui/button";
  import { CopyIcon } from "phosphor-svelte";

  const publicKey = "orvo_pk_01******************************";
  const privateKey = "orvo_sk_01******************************";

  const copyKey = async (value: string) => {
    await navigator.clipboard.writeText(value);
  };
</script>

<div class="mx-auto flex w-full max-w-5xl flex-col gap-12 py-1">
  <section class="space-y-4">
    <div class="space-y-1.5">
      <h2 class="text-2xl font-semibold tracking-tight text-foreground">
        Public
      </h2>
      <p class="text-sm text-muted-foreground">
        For browser and client-side telemetry SDKs
      </p>
    </div>

    <div class="flex flex-col gap-3 sm:flex-row sm:items-center">
      <div
        class="border-input bg-background flex h-12 min-w-0 flex-1 items-center rounded-lg border px-4"
      >
        <code class="block min-w-0 truncate text-sm text-foreground">
          {publicKey}
        </code>
      </div>

      <Button
        variant="outline"
        size="icon"
        aria-label="Copy public ingest key"
        onclick={() => copyKey(publicKey)}
      >
        <CopyIcon />
      </Button>
    </div>
  </section>

  <section class="space-y-4">
    <div class="space-y-1.5">
      <h2 class="text-2xl font-semibold tracking-tight text-foreground">
        Private
      </h2>
      <p class="text-sm text-muted-foreground">
        For server-side ingestion and backend services
      </p>
    </div>

    <div class="flex flex-col gap-3 sm:flex-row sm:items-center">
      <div
        class="border-input bg-background flex h-12 min-w-0 flex-1 items-center rounded-lg border px-4"
      >
        <code class="block min-w-0 truncate text-sm text-foreground">
          {privateKey}
        </code>
      </div>

      <Button
        variant="outline"
        size="icon"
        aria-label="Copy private ingest key"
        onclick={() => copyKey(privateKey)}
      >
        <CopyIcon />
      </Button>
    </div>
  </section>
</div>
