<script lang="ts">
  import { invalidateAll } from "$app/navigation";
  import {
    createHeartbeatMonitorCommand,
    updateHeartbeatMonitorCommand,
  } from "$lib/api/heartbeats.remote";
  import { Badge } from "@repo/components/ui/badge";
  import { Button } from "@repo/components/ui/button";
  import * as Dialog from "@repo/components/ui/dialog";
  import { Input } from "@repo/components/ui/input";
  import * as Select from "@repo/components/ui/select";
  import { toast } from "@repo/components/ui/sonner";
  import type { Snippet } from "svelte";

  const durationUnits = [
    { value: "seconds", label: "seconds", seconds: 1 },
    { value: "minutes", label: "minutes", seconds: 60 },
    { value: "hours", label: "hours", seconds: 60 * 60 },
    { value: "days", label: "days", seconds: 60 * 60 * 24 },
  ] as const;

  let {
    heartbeatMonitor = null,
    destinations,
    onSuccess,
    child,
    children,
    class: className,
  }: {
    heartbeatMonitor?: {
      id: string;
      name: string;
      expectedEverySeconds: number;
      graceSeconds: number;
      destinationIds: string[];
    } | null;
    destinations: {
      id: string;
      name: string;
      kind: "webhook" | "email";
    }[];
    onSuccess?: () => void | Promise<void>;
    child?: Snippet<[{ props: Record<string, unknown> }]>;
    children?: Snippet;
    class?: string;
  } = $props();

  let open = $state(false);
  let name = $state("");
  let expectedEveryValue = $state(5);
  let expectedEveryUnit =
    $state<(typeof durationUnits)[number]["value"]>("minutes");
  let graceValue = $state(2);
  let graceUnit = $state<(typeof durationUnits)[number]["value"]>("minutes");
  let selectedDestinationIds = $state<string[]>([]);
  let submitting = $state(false);

  $effect(() => {
    if (!open) {
      return;
    }

    if (!heartbeatMonitor) {
      name = "";
      expectedEveryValue = 5;
      expectedEveryUnit = "minutes";
      graceValue = 2;
      graceUnit = "minutes";
      selectedDestinationIds = [];
      return;
    }

    const expectedEveryDuration =
      [...durationUnits]
        .reverse()
        .find(
          (unit) =>
            heartbeatMonitor.expectedEverySeconds > 0 &&
            heartbeatMonitor.expectedEverySeconds % unit.seconds === 0,
        ) ?? durationUnits[0];
    const graceDuration =
      [...durationUnits]
        .reverse()
        .find(
          (unit) =>
            heartbeatMonitor.graceSeconds > 0 &&
            heartbeatMonitor.graceSeconds % unit.seconds === 0,
        ) ?? durationUnits[0];

    name = heartbeatMonitor.name;
    expectedEveryValue =
      heartbeatMonitor.expectedEverySeconds / expectedEveryDuration.seconds;
    expectedEveryUnit = expectedEveryDuration.value;
    graceValue = heartbeatMonitor.graceSeconds / graceDuration.seconds;
    graceUnit = graceDuration.value;
    selectedDestinationIds = [...heartbeatMonitor.destinationIds];
  });

  const submit = async () => {
    submitting = true;

    const payload = {
      name,
      expectedEverySeconds:
        expectedEveryValue *
        (durationUnits.find((unit) => unit.value === expectedEveryUnit)
          ?.seconds ?? 1),
      graceSeconds:
        graceValue *
        (durationUnits.find((unit) => unit.value === graceUnit)?.seconds ?? 1),
      destinationIds: selectedDestinationIds,
    };
    const result = heartbeatMonitor
      ? await updateHeartbeatMonitorCommand({
          id: heartbeatMonitor.id,
          ...payload,
        })
      : await createHeartbeatMonitorCommand(payload);

    if (!result.success) {
      submitting = false;
      toast.error(result.error);
      return;
    }

    open = false;
    submitting = false;
    await invalidateAll();
    await onSuccess?.();
    toast.success(
      heartbeatMonitor
        ? "Heartbeat monitor updated."
        : "Heartbeat monitor created.",
    );
  };
</script>

<Dialog.Root bind:open>
  {#if child || children}
    <Dialog.Trigger class={className} {child}>
      {@render children?.()}
    </Dialog.Trigger>
  {/if}
  <Dialog.Content class="sm:max-w-2xl">
    <Dialog.Header>
      <Dialog.Title>
        {heartbeatMonitor
          ? "Edit heartbeat monitor"
          : "Create heartbeat monitor"}
      </Dialog.Title>
    </Dialog.Header>

    <div class="grid gap-4 py-2">
      <label class="grid gap-2">
        <span class="text-sm font-medium">Name</span>
        <Input bind:value={name} placeholder="Nightly sync" />
      </label>

      <div class="grid gap-4">
        <label class="grid gap-2">
          <span class="text-sm font-medium">Expect a heartbeat every</span>
          <div class="grid gap-3 sm:grid-cols-[minmax(0,120px)_minmax(0,1fr)]">
            <Input bind:value={expectedEveryValue} type="number" min="1" />
            <Select.Root type="single" bind:value={expectedEveryUnit}>
              <Select.Trigger class="w-full bg-background">
                {durationUnits.find((unit) => unit.value === expectedEveryUnit)
                  ?.label ?? "Select unit"}
              </Select.Trigger>
              <Select.Content>
                {#each durationUnits as unit}
                  <Select.Item value={unit.value} label={unit.label} />
                {/each}
              </Select.Content>
            </Select.Root>
          </div>
        </label>

        <label class="grid gap-2">
          <span class="text-sm font-medium">With a grace period of</span>
          <div class="grid gap-3 sm:grid-cols-[minmax(0,120px)_minmax(0,1fr)]">
            <Input bind:value={graceValue} type="number" min="0" />
            <Select.Root type="single" bind:value={graceUnit}>
              <Select.Trigger class="w-full bg-background">
                {durationUnits.find((unit) => unit.value === graceUnit)
                  ?.label ?? "Select unit"}
              </Select.Trigger>
              <Select.Content>
                {#each durationUnits as unit}
                  <Select.Item value={unit.value} label={unit.label} />
                {/each}
              </Select.Content>
            </Select.Root>
          </div>
        </label>
      </div>

      <div class="grid gap-3">
        <div class="space-y-1">
          <p class="text-sm font-medium">How should we notify you?</p>
        </div>

        {#if destinations.length === 0}
          <div
            class="rounded-xl border border-dashed px-4 py-6 text-sm text-muted-foreground"
          >
            No destinations yet. Add one in settings first.
          </div>
        {:else}
          <Select.Root type="multiple" bind:value={selectedDestinationIds}>
            <Select.Trigger class="w-full bg-background text-left">
              {selectedDestinationIds.length === 0
                ? "Select notification destination"
                : `${
                    destinations.find(
                      (destination) =>
                        destination.id === selectedDestinationIds[0],
                    )?.name ?? "Selected destination"
                  }${
                    selectedDestinationIds.length > 1
                      ? ` + ${selectedDestinationIds.length - 1} more`
                      : ""
                  }`}
            </Select.Trigger>
            <Select.Content>
              {#each destinations as destination}
                <Select.Item value={destination.id} label={destination.name}>
                  <div class="flex min-w-0 items-center gap-2">
                    <span class="truncate">{destination.name}</span>
                    <Badge variant="outline" class="h-4 text-xs">
                      {destination.kind === "webhook" ? "Webhook" : "Email"}
                    </Badge>
                  </div>
                </Select.Item>
              {/each}
            </Select.Content>
          </Select.Root>
        {/if}
      </div>
    </div>

    <Dialog.Footer>
      <Button variant="outline" onclick={() => (open = false)}>Cancel</Button>
      <Button loading={submitting} onclick={submit}>
        {heartbeatMonitor ? "Save" : "Create"}
      </Button>
    </Dialog.Footer>
  </Dialog.Content>
</Dialog.Root>
