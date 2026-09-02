<script lang="ts">
  import { invalidateAll, replaceState } from "$app/navigation";
  import { resolve } from "$app/paths";
  import { page } from "$app/state";
  import {
    createNotificationDestinationCommand,
    deleteNotificationDestinationCommand,
    testNotificationDestinationCommand,
    updateNotificationDestinationCommand,
  } from "$lib/api/notification-destinations.remote";
  import { cn } from "@repo/components";
  import * as AlertDialog from "@repo/components/ui/alert-dialog";
  import { Badge } from "@repo/components/ui/badge";
  import { Button } from "@repo/components/ui/button";
  import * as Card from "@repo/components/ui/card";
  import * as Dialog from "@repo/components/ui/dialog";
  import * as DropdownMenu from "@repo/components/ui/dropdown-menu";
  import { FieldDescription } from "@repo/components/ui/field";
  import { Input } from "@repo/components/ui/input";
  import * as InputGroup from "@repo/components/ui/input-group";
  import { Label } from "@repo/components/ui/label";
  import * as Select from "@repo/components/ui/select";
  import { toast } from "@repo/components/ui/sonner";
  import { Spinner } from "@repo/components/ui/spinner";
  import { Switch } from "@repo/components/ui/switch";
  import {
    IconCircleCheck,
    IconCircle,
    IconCircleFilled,
    IconCircleOff,
    IconDotsVertical,
    IconInfoCircleFilled,
    IconPencil,
    IconPlus,
    IconSend,
    IconTrash,
    IconX,
  } from "@tabler/icons-svelte";

  let { data } = $props();

  const destinations = $derived(
    data.destinationsResult.success
      ? data.destinationsResult.data.destinations.filter(
          (destination) => destination.kind !== "slack",
        )
      : [],
  );
  const defaultRecipients = $derived(
    data.defaultRecipientsResult.success
      ? data.defaultRecipientsResult.data.recipients
      : [],
  );
  const loadError = $derived(
    data.destinationsResult.success ? "" : data.destinationsResult.error,
  );

  let dialogOpen = $state(false);
  let submitting = $state(false);
  let testingId = $state("");
  let deletingId = $state("");
  let togglingId = $state("");
  let editingId = $state("");
  let destinationToDelete = $state<(typeof destinations)[number] | null>(null);
  let kind = $state<"webhook" | "email">("webhook");
  let name = $state("");
  let url = $state("");
  let headers = $state<Array<{ key: string; value: string }>>([]);
  let recipients = $state<string[]>([]);
  let recipientDraft = $state("");
  let isEnabled = $state(true);
  let formError = $state("");
  let createQueryHandled = $state(false);

  const resetForm = (nextKind: "webhook" | "email") => {
    editingId = "";
    kind = nextKind;
    name = "";
    url = "";
    headers = [];
    recipients = nextKind === "email" ? defaultRecipients.slice(0, 5) : [];
    recipientDraft = "";
    isEnabled = true;
    formError = "";
  };

  const openCreate = () => {
    resetForm("webhook");
    dialogOpen = true;
  };

  const clearCreateQuery = () => {
    if (page.url.searchParams.get("create") === "1") {
      replaceState(
        resolve("/(dashboard)/a/[app_id]/settings/notification-destinations", {
          app_id: page.params.app_id!,
        }),
        page.state,
      );
    }
  };

  const handleDialogOpenChange = (open: boolean) => {
    if (!open && !dialogOpen) return;

    dialogOpen = open;
    if (!open) clearCreateQuery();
  };

  const openEdit = (destination: (typeof destinations)[number]) => {
    if (destination.kind === "slack") return;

    editingId = destination.id;
    kind = destination.kind;
    name = destination.name;
    url = destination.webhookUrl ?? "";
    headers = destination.kind === "webhook" ? destination.headers : [];
    recipients =
      destination.kind === "email" ? destination.emailRecipients : [];
    recipientDraft = "";
    isEnabled = destination.isEnabled;
    formError = "";
    dialogOpen = true;
  };

  const addRecipient = () => {
    const recipient = recipientDraft.trim().toLowerCase();
    if (!recipient) return true;

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(recipient)) {
      formError = "Enter a valid email address.";
      return false;
    }

    if (recipients.includes(recipient)) {
      recipientDraft = "";
      return true;
    }

    if (recipients.length >= 5) {
      formError = "You can add up to 5 email addresses.";
      return false;
    }

    recipients = [...recipients, recipient];
    recipientDraft = "";
    formError = "";
    return true;
  };

  const submit = async () => {
    submitting = true;
    formError = "";

    try {
      if (kind === "email" && !addRecipient()) return;

      const preparedHeaders = headers.map((header) => ({
        key: header.key.trim(),
        value: header.value.trim(),
      }));
      if (
        kind === "webhook" &&
        preparedHeaders.some((header) => !header.key || !header.value)
      ) {
        throw new Error("Complete or remove each custom header.");
      }

      const payload =
        kind === "webhook"
          ? {
              kind,
              name,
              url,
              headers: preparedHeaders,
              isEnabled,
            }
          : {
              kind,
              name,
              recipients,
              isEnabled,
            };
      const result = editingId
        ? await updateNotificationDestinationCommand({
            id: editingId,
            ...payload,
          } as never)
        : await createNotificationDestinationCommand(payload as never);

      if (!result.success) {
        formError = result.error;
        return;
      }

      const wasEditing = Boolean(editingId);
      clearCreateQuery();
      dialogOpen = false;
      await invalidateAll();
      toast.success(
        wasEditing
          ? "Notification destination updated."
          : "Notification destination created.",
      );
    } catch (error) {
      formError =
        error instanceof Error ? error.message : "Invalid destination input.";
    } finally {
      submitting = false;
    }
  };

  const remove = async () => {
    if (!destinationToDelete) return;

    deletingId = destinationToDelete.id;
    const result = await deleteNotificationDestinationCommand(
      destinationToDelete.id,
    );
    deletingId = "";

    if (!result.success) {
      toast.error(result.error);
      return;
    }

    destinationToDelete = null;
    await invalidateAll();
    toast.success("Notification destination deleted.");
  };

  const testDestination = async (id: string) => {
    testingId = id;
    const result = await testNotificationDestinationCommand(id);
    testingId = "";

    if (!result.success) {
      toast.error(result.error);
      return;
    }

    toast.success("Test notification sent.");
    await invalidateAll();
  };

  const toggleDestination = async (
    destination: (typeof destinations)[number],
  ) => {
    if (destination.kind === "slack") return;

    togglingId = destination.id;
    const result = await updateNotificationDestinationCommand(
      destination.kind === "webhook"
        ? {
            id: destination.id,
            kind: destination.kind,
            name: destination.name,
            url: destination.webhookUrl ?? "",
            headers: destination.headers,
            isEnabled: !destination.isEnabled,
          }
        : {
            id: destination.id,
            kind: destination.kind,
            name: destination.name,
            recipients: destination.emailRecipients,
            isEnabled: !destination.isEnabled,
          },
    );
    togglingId = "";

    if (!result.success) {
      toast.error(result.error);
      return;
    }

    await invalidateAll();
    toast.success(
      `Notification destination ${destination.isEnabled ? "disabled" : "enabled"}.`,
    );
  };

  $effect(() => {
    const shouldCreate = page.url.searchParams.get("create") === "1";

    if (shouldCreate && !createQueryHandled) {
      createQueryHandled = true;
      openCreate();
    } else if (!shouldCreate) {
      createQueryHandled = false;
    }
  });
</script>

<div class="flex w-full max-w-4xl flex-col gap-8">
  {#if loadError}
    <p class="text-sm text-destructive" role="alert">{loadError}</p>
  {:else if destinations.length === 0}
    <div
      class="flex flex-col items-center pt-[5%] text-sm text-muted-foreground"
    >
      No notification destinations yet.
    </div>
  {:else}
    <Card.Root class="gap-0 divide-y rounded-xl p-0">
      {#each destinations as destination (destination.id)}
        <div class="flex items-center gap-2 px-2 py-2">
          <div
            class="flex min-w-0 flex-1 flex-col gap-1 rounded-lg px-2 py-0.5 pt-0.75"
          >
            <div class="flex flex-wrap items-center gap-2 text-sm font-medium">
              {destination.name}
              <Badge
                variant="outline"
                class={cn(
                  "gap-0.5 pr-1.5 pl-0.75",
                  destination.isEnabled
                    ? "border-green-600/20 bg-green-600/7 text-green-700"
                    : "border-muted-foreground/20 bg-muted-foreground/7 text-muted-foreground",
                )}
              >
                {#if destination.isEnabled}
                  <IconCircleFilled class="size-2.5" />
                {:else}
                  <IconCircle class="size-2.5" />
                {/if}
                {destination.isEnabled ? "Enabled" : "Disabled"}
              </Badge>
            </div>

            <div
              class="flex flex-wrap gap-0.75 gap-y-1 text-[0.8rem] text-muted-foreground"
            >
              {#if destination.kind === "webhook"}
                Webhook notifications are sent to
                <span class="font-medium break-all text-secondary-foreground"
                  >{destination.webhookUrl}{destination.headers.length === 0
                    ? "."
                    : ""}</span
                >
                {#if destination.headers.length > 0}
                  with
                  <span class="font-medium text-secondary-foreground">
                    {destination.headers.length} custom
                    {destination.headers.length === 1 ? "header" : "headers"}.
                  </span>
                {/if}
              {:else}
                Email notifications are sent to
                <span class="font-medium text-secondary-foreground">
                  {destination
                    .emailRecipients[0]}{#if destination.emailRecipients.length > 1}
                    + {destination.emailRecipients.length - 1} more{/if}.
                </span>
              {/if}
            </div>
          </div>

          <DropdownMenu.Root>
            <DropdownMenu.Trigger>
              {#snippet child({ props })}
                <Button
                  {...props}
                  variant="ghost"
                  size="icon-sm"
                  aria-label={`Open actions for ${destination.name}`}
                >
                  <IconDotsVertical />
                </Button>
              {/snippet}
            </DropdownMenu.Trigger>
            <DropdownMenu.Content align="end" class="w-44">
              <DropdownMenu.Item
                disabled={testingId.length > 0}
                onSelect={() => void testDestination(destination.id)}
              >
                {#if testingId === destination.id}
                  <Spinner class="size-3" />
                {:else}
                  <IconSend />
                {/if}
                Test destination
              </DropdownMenu.Item>
              <DropdownMenu.Item onSelect={() => openEdit(destination)}>
                <IconPencil />
                Edit
              </DropdownMenu.Item>
              <DropdownMenu.Item
                disabled={togglingId.length > 0}
                onSelect={() => void toggleDestination(destination)}
              >
                {#if destination.isEnabled}
                  <IconCircleOff />
                  Disable
                {:else}
                  <IconCircleCheck />
                  Enable
                {/if}
              </DropdownMenu.Item>
              <DropdownMenu.Separator />
              <DropdownMenu.Item
                variant="destructive"
                onSelect={() => (destinationToDelete = destination)}
              >
                <IconTrash />
                Delete
              </DropdownMenu.Item>
            </DropdownMenu.Content>
          </DropdownMenu.Root>
        </div>
      {/each}
    </Card.Root>
  {/if}
</div>

<Dialog.Root open={dialogOpen} onOpenChange={handleDialogOpenChange}>
  <Dialog.Content class="sm:max-w-xl">
    <Dialog.Header>
      <Dialog.Title>
        {editingId ? "Edit destination" : "Add notification destination"}
      </Dialog.Title>
    </Dialog.Header>

    <div class="grid gap-5 py-1">
      {#if !editingId}
        <div class="grid gap-2">
          <Label for="destination-type">Destination type</Label>
          <Select.Root type="single" bind:value={kind}>
            <Select.Trigger id="destination-type" class="w-full">
              {kind === "webhook" ? "Webhook" : "Email"}
            </Select.Trigger>
            <Select.Content>
              <Select.Item value="webhook" label="Webhook" />
              <Select.Item value="email" label="Email" />
            </Select.Content>
          </Select.Root>
        </div>
      {/if}

      <div class="grid gap-2">
        <Label for="destination-name">Name</Label>
        <Input
          id="destination-name"
          bind:value={name}
          maxlength={64}
          placeholder="Primary on-call"
        />
      </div>

      {#if kind === "webhook"}
        <div class="grid gap-2">
          <Label for="destination-url">URL</Label>
          <Input
            id="destination-url"
            type="url"
            bind:value={url}
            maxlength={2048}
            placeholder="https://example.com/orvo/notifications"
          />
        </div>

        <div class="grid gap-3">
          <div class="flex items-center justify-between gap-3">
            <Label>Custom headers</Label>
            <Button
              variant="outline"
              size="sm"
              disabled={headers.length >= 20}
              onclick={() => (headers = [...headers, { key: "", value: "" }])}
            >
              <IconPlus data-slot="button-icon" />
              Add header
            </Button>
          </div>

          {#each headers as header, index (header)}
            <div class="grid grid-cols-[1fr_1.5fr_auto] gap-2">
              <Input
                bind:value={header.key}
                maxlength={100}
                aria-label={`Header ${index + 1} name`}
                placeholder="Authorization"
              />
              <Input
                bind:value={header.value}
                maxlength={1000}
                aria-label={`Header ${index + 1} value`}
                placeholder="Bearer token"
              />
              <Button
                variant="ghost"
                size="icon"
                aria-label={`Remove header ${index + 1}`}
                onclick={() =>
                  (headers = headers.filter(
                    (_, headerIndex) => headerIndex !== index,
                  ))}
              >
                <IconX />
              </Button>
            </div>
          {/each}
        </div>
      {:else}
        <div class="grid gap-2">
          <Label for="destination-recipients">Recipients</Label>
          <InputGroup.Root
            class="h-auto min-h-8 flex-wrap justify-start gap-1 px-1.5 py-1"
          >
            {#each recipients as recipient (recipient)}
              <div
                class="inline-flex h-6 min-w-0 items-center gap-1 rounded-md border bg-secondary pr-0.5 pl-2 text-sm"
              >
                <span class="max-w-64 truncate">{recipient}</span>
                <Button
                  variant="ghost"
                  size="icon-xs"
                  class="size-5 rounded-sm"
                  aria-label={`Remove ${recipient}`}
                  onclick={() =>
                    (recipients = recipients.filter(
                      (value) => value !== recipient,
                    ))}
                >
                  <IconX />
                </Button>
              </div>
            {/each}
            <InputGroup.Input
              id="destination-recipients"
              type="email"
              bind:value={recipientDraft}
              class="h-6 min-w-40 flex-1 px-1 py-0"
              placeholder={recipients.length === 0 ? "owner@example.com" : ""}
              disabled={recipients.length >= 5}
              onkeydown={(event) => {
                if (event.key === "Enter" || event.key === " ") {
                  event.preventDefault();
                  addRecipient();
                } else if (
                  event.key === "Backspace" &&
                  !recipientDraft &&
                  recipients.length > 0
                ) {
                  recipients = recipients.slice(0, -1);
                }
              }}
            />
          </InputGroup.Root>
          <FieldDescription class="flex items-start gap-1.5 text-sm">
            <IconInfoCircleFilled class="mt-0.5 size-4 shrink-0" />
            <span>Press Enter or Space to add up to 5 email addresses.</span>
          </FieldDescription>
        </div>
      {/if}

      <div
        class="flex items-center justify-between gap-4 rounded-lg border px-3 py-3"
      >
        <Label for="destination-enabled">Enabled</Label>
        <Switch id="destination-enabled" bind:checked={isEnabled} />
      </div>

      {#if formError}
        <p class="text-sm text-destructive" role="alert">{formError}</p>
      {/if}
    </div>

    <Dialog.Footer>
      <Button variant="outline" onclick={() => handleDialogOpenChange(false)}>
        Cancel
      </Button>
      <Button loading={submitting} onclick={submit}>
        {#if editingId}
          <IconPencil data-slot="button-icon" />
          Save changes
        {:else}
          <IconPlus data-slot="button-icon" />
          Add destination
        {/if}
      </Button>
    </Dialog.Footer>
  </Dialog.Content>
</Dialog.Root>

<AlertDialog.Root
  open={destinationToDelete !== null}
  onOpenChange={(open) => {
    if (!open && !deletingId) destinationToDelete = null;
  }}
>
  <AlertDialog.Content>
    <AlertDialog.Header>
      <AlertDialog.Title>Delete notification destination?</AlertDialog.Title>
      <AlertDialog.Description>
        {#if destinationToDelete}
          <strong class="font-medium text-foreground">
            {destinationToDelete.name}
          </strong>
          will be removed from alert rules and heartbeat monitors. Its recorded deliveries
          will also be deleted. This action cannot be undone.
        {/if}
      </AlertDialog.Description>
    </AlertDialog.Header>
    <AlertDialog.Footer>
      <AlertDialog.Cancel disabled={Boolean(deletingId)}>
        Cancel
      </AlertDialog.Cancel>
      <AlertDialog.Action
        variant="destructive"
        disabled={Boolean(deletingId)}
        onclick={remove}
      >
        {#if deletingId}
          <Spinner class="size-4" />
        {/if}
        Delete destination
      </AlertDialog.Action>
    </AlertDialog.Footer>
  </AlertDialog.Content>
</AlertDialog.Root>
