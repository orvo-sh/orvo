<script lang="ts">
  import { browser } from "$app/environment";
  import { organizationActivationState } from "$lib/stores/organization-activation.svelte";
  import { cn } from "@repo/components";
  import { Button } from "@repo/components/ui/button";
  import {
    IconCheck,
    IconChevronDown,
    IconChevronUp,
    IconX,
  } from "@tabler/icons-svelte";
  import { slide } from "svelte/transition";

  let {
    organizationId,
    initialOpen = true,
  }: {
    organizationId: string;
    initialOpen?: boolean;
  } = $props();

  let open = $state(false);
  let mounted = $state(false);
  const activation = $derived(organizationActivationState.activation);

  const steps = $derived(
    [
      {
        label: "Create your first app",
        complete: activation?.hasCreatedFirstApp ?? false,
      },
      {
        label: "Send your first signals",
        complete: activation?.hasSentFirstSignals ?? false,
      },
      {
        label: "View your telemetry",
        complete: activation?.hasViewedTelemetry ?? false,
      },
      {
        label: "Create your first alert",
        complete: activation?.hasCreatedFirstAlert ?? false,
      },
      {
        label: "Invite a teammate",
        complete: activation?.hasInvitedTeammate ?? false,
      },
    ].map((step, i, arr) => ({
      ...step,
      current: i === arr.findIndex((s) => !s.complete),
    })),
  );

  const persistOpenState = (nextOpen: boolean) => {
    if (!browser) {
      return;
    }

    document.cookie = `organization_activation_open_${organizationId}=${nextOpen ? "1" : "0"}; Path=/; Max-Age=31536000; SameSite=Lax`;
  };

  $effect(() => {
    if (mounted) {
      return;
    }

    mounted = true;
    open = initialOpen;
  });
</script>

<div class="fixed right-6 bottom-0 z-40 w-88 max-w-[calc(100vw-2rem)]">
  <section
    class="overflow-hidden rounded-t-lg bg-card shadow-2xl ring ring-foreground/10"
  >
    <div class="flex items-center gap-2 pr-2 pl-3">
      <button
        class="flex w-full items-center gap-3 py-3"
        onclick={() => {
          open = !open;
          document.cookie = `organization_activation_open_${organizationId}=${open ? "1" : "0"}; Path=/; Max-Age=31536000; SameSite=Lax`;
        }}
      >
        {#if open}
          <IconChevronDown class={cn("size-4.5")} />
        {:else}
          <IconChevronUp class={cn("size-4.5")} />
        {/if}
        <p class="text-sm font-medium text-foreground">
          Getting started ({activation?.completedCount ??
            0}/{activation?.totalCount ?? 5})
        </p>
      </button>
      <Button size="icon-sm" variant="secondary">
        <IconX />
      </Button>
    </div>

    {#if open}
      <div
        class="flex flex-col gap-4 border-t px-3 py-3"
        transition:slide={{ axis: "y", duration: 180 }}
      >
        {#each steps as step}
          <div class="flex items-center gap-3 text-sm text-foreground">
            <span
              class={cn(
                "flex size-4.5 shrink-0 items-center justify-center rounded-full border",
                step.complete
                  ? "border-primary bg-primary text-white"
                  : step.current
                    ? "border-[1.5px] border-primary text-primary"
                    : "border-[1.5px] border-border text-muted-foreground",
              )}
            >
              {#if step.complete}
                <IconCheck class="size-3 stroke-3" />
              {/if}
            </span>

            <span
              class={cn(
                step.complete || step.current
                  ? "text-secondary-foreground"
                  : "text-muted-foreground",
              )}
            >
              {step.label}
            </span>
          </div>
        {/each}
      </div>
    {/if}
  </section>
</div>
