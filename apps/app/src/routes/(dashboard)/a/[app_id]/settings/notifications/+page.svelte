<script lang="ts">
  import { invalidateAll } from "$app/navigation";
  import {
    createNotificationDestinationCommand,
    deleteNotificationDestinationCommand,
    testNotificationDestinationCommand,
    updateNotificationDestinationCommand,
  } from "$lib/api/notification-destinations.remote";
  import { Badge } from "@repo/components/ui/badge";
  import { Button } from "@repo/components/ui/button";
  import { Input } from "@repo/components/ui/input";
  import { Switch } from "@repo/components/ui/switch";
  import { Textarea } from "@repo/components/ui/textarea";
  import { toast } from "@repo/components/ui/sonner";
  import * as Dialog from "@repo/components/ui/dialog";
  import {
    IconMail,
    IconPlus,
    IconSend,
    IconTrash,
    IconWebhook,
  } from "@tabler/icons-svelte";

  let { data } = $props();

  let dialogOpen = $state(false);
  let submitting = $state(false);
  let testingId = $state("");
  let deletingId = $state("");
  let editingId = $state("");
  let kind = $state<"webhook" | "email">("webhook");
  let name = $state("");
  let url = $state("");
  let headersText = $state("");
  let recipientsText = $state("");
  let isEnabled = $state(true);
  let formError = $state("");

  const destinations = $derived(
    data.destinationsResult.success
      ? data.destinationsResult.data.destinations
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

  const resetForm = (nextKind: "webhook" | "email") => {
    editingId = "";
    kind = nextKind;
    name = "";
    url = "";
    headersText = "";
    recipientsText =
      nextKind === "email" ? defaultRecipients.join("\n") : "";
    isEnabled = true;
    formError = "";
  };

  const openCreate = (nextKind: "webhook" | "email") => {
    resetForm(nextKind);
    dialogOpen = true;
  };

  const openEdit = (destination: (typeof destinations)[number]) => {
    editingId = destination.id;
    kind = destination.kind;
    name = destination.name;
    url = destination.webhookUrl ?? "";
    headersText =
      destination.kind === "webhook"
        ? destination.headers
            .map((header) => `${header.key}: ${header.value}`)
            .join("\n")
        : "";
    recipientsText =
      destination.kind === "email"
        ? destination.emailRecipients.join("\n")
        : "";
    isEnabled = destination.isEnabled;
    formError = "";
    dialogOpen = true;
  };

  const parseHeaders = () =>
    headersText
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean)
      .map((line) => {
        const separatorIndex = line.indexOf(":");
        if (separatorIndex === -1) {
          throw new Error(`Invalid header: ${line}`);
        }

        return {
          key: line.slice(0, separatorIndex).trim(),
          value: line.slice(separatorIndex + 1).trim(),
        };
      });

  const parseRecipients = () =>
    [...new Set(
      recipientsText
        .split(/[\n,]+/g)
        .map((value) => value.trim().toLowerCase())
        .filter(Boolean),
    )];

  const submit = async () => {
    submitting = true;
    formError = "";

    try {
      const payload =
        kind === "webhook"
          ? {
              kind,
              name,
              url,
              headers: parseHeaders(),
              isEnabled,
            }
          : {
              kind,
              name,
              recipients: parseRecipients(),
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
        submitting = false;
        return;
      }

      dialogOpen = false;
      submitting = false;
      await invalidateAll();
      toast.success(
        editingId
          ? "Notification destination updated."
          : "Notification destination created.",
      );
    } catch (error) {
      formError =
        error instanceof Error ? error.message : "Invalid destination input.";
      submitting = false;
    }
  };

  const remove = async (id: string) => {
    deletingId = id;
    const result = await deleteNotificationDestinationCommand(id);
    deletingId = "";

    if (!result.success) {
      toast.error(result.error);
      return;
    }

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
</script>

<div class="mx-auto flex w-full max-w-5xl flex-col gap-5 py-1">
  <section
    class="flex flex-col gap-4 rounded-xl border bg-background px-5 py-5 sm:flex-row sm:items-center sm:justify-between"
  >
    <div class="space-y-1">
      <h2 class="text-base font-semibold">Notification destinations</h2>
      <p class="max-w-2xl text-sm text-muted-foreground">
        Create reusable webhook and email destinations, then attach them to
        heartbeat monitors.
      </p>
    </div>

    <div class="flex flex-wrap gap-2">
      <Button variant="outline" onclick={() => openCreate("webhook")}>
        <IconWebhook data-slot="button-icon" />
        New webhook
      </Button>
      <Button onclick={() => openCreate("email")}>
        <IconMail data-slot="button-icon" />
        New email destination
      </Button>
    </div>
  </section>

  {#if loadError}
    <div
      class="rounded-lg border border-destructive/20 bg-destructive/5 px-4 py-3 text-sm text-destructive"
    >
      {loadError}
    </div>
  {/if}

  {#if destinations.length === 0}
    <section class="rounded-xl border border-dashed bg-background px-5 py-10 text-center">
      <h3 class="text-base font-semibold">No notification destinations yet</h3>
      <p class="mt-2 text-sm text-muted-foreground">
        Start with a webhook for automation or an email destination for human
        responders.
      </p>
      <div class="mt-4 flex justify-center gap-2">
        <Button variant="outline" onclick={() => openCreate("webhook")}>
          <IconWebhook data-slot="button-icon" />
          Add webhook
        </Button>
        <Button onclick={() => openCreate("email")}>
          <IconMail data-slot="button-icon" />
          Add email destination
        </Button>
      </div>
    </section>
  {:else}
    <section class="grid gap-3">
      {#each destinations as destination (destination.id)}
        <article class="rounded-xl border bg-background px-5 py-4">
          <div
            class="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between"
          >
            <div class="space-y-2">
              <div class="flex items-center gap-2">
                <h3 class="text-sm font-semibold">{destination.name}</h3>
                <Badge variant="outline">
                  {destination.kind === "webhook" ? "Webhook" : "Email"}
                </Badge>
                <Badge variant="outline">
                  {destination.isEnabled ? "Enabled" : "Disabled"}
                </Badge>
              </div>

              {#if destination.kind === "webhook"}
                <p class="break-all text-sm text-muted-foreground">
                  {destination.webhookUrl}
                </p>
                <p class="text-xs text-muted-foreground">
                  {destination.headers.length} custom
                  {destination.headers.length === 1 ? " header" : " headers"}
                </p>
              {:else}
                <p class="text-sm text-muted-foreground">
                  {destination.emailRecipients.join(", ")}
                </p>
                <p class="text-xs text-muted-foreground">
                  {destination.emailRecipients.length} recipient{destination.emailRecipients
                    .length === 1
                    ? ""
                    : "s"}
                </p>
              {/if}
            </div>

            <div class="flex flex-wrap gap-2">
              <Button
                variant="outline"
                size="sm"
                loading={testingId === destination.id}
                onclick={() => testDestination(destination.id)}
              >
                <IconSend data-slot="button-icon" />
                Test
              </Button>
              <Button
                variant="outline"
                size="sm"
                onclick={() => openEdit(destination)}
              >
                Edit
              </Button>
              <Button
                variant="outline"
                size="sm"
                loading={deletingId === destination.id}
                onclick={() => remove(destination.id)}
              >
                <IconTrash data-slot="button-icon" />
                Delete
              </Button>
            </div>
          </div>
        </article>
      {/each}
    </section>
  {/if}
</div>

<Dialog.Root bind:open={dialogOpen}>
  <Dialog.Content class="sm:max-w-2xl">
    <Dialog.Header>
      <Dialog.Title>
        {editingId
          ? "Edit notification destination"
          : kind === "webhook"
            ? "New webhook destination"
            : "New email destination"}
      </Dialog.Title>
      <Dialog.Description>
        {kind === "webhook"
          ? "Webhooks receive JSON payloads for heartbeat events."
          : "Email destinations notify people when heartbeat monitors miss or recover."}
      </Dialog.Description>
    </Dialog.Header>

    <div class="grid gap-4 py-2">
      <label class="grid gap-2">
        <span class="text-sm font-medium">Name</span>
        <Input bind:value={name} placeholder="Primary on-call" />
      </label>

      {#if kind === "webhook"}
        <label class="grid gap-2">
          <span class="text-sm font-medium">URL</span>
          <Input
            bind:value={url}
            placeholder="https://example.com/orvo/heartbeats"
          />
        </label>

        <label class="grid gap-2">
          <span class="text-sm font-medium">Headers</span>
          <Textarea
            bind:value={headersText}
            rows={6}
            placeholder={`Authorization: Bearer ...\nX-Team: platform`}
          />
          <span class="text-xs text-muted-foreground">
            One header per line using <code>Name: Value</code>.
          </span>
        </label>
      {:else}
        <label class="grid gap-2">
          <span class="text-sm font-medium">Recipients</span>
          <Textarea
            bind:value={recipientsText}
            rows={6}
            placeholder="owner@example.com&#10;team@example.com"
          />
          <span class="text-xs text-muted-foreground">
            Separate email addresses with new lines or commas.
          </span>
        </label>
      {/if}

      <label class="flex items-center justify-between rounded-xl border px-4 py-3">
        <div>
          <p class="text-sm font-medium">Enabled</p>
          <p class="text-xs text-muted-foreground">
            Disabled destinations stay attached but won’t receive deliveries.
          </p>
        </div>
        <Switch bind:checked={isEnabled} />
      </label>

      {#if formError}
        <div
          class="rounded-lg border border-destructive/20 bg-destructive/5 px-4 py-3 text-sm text-destructive"
        >
          {formError}
        </div>
      {/if}
    </div>

    <Dialog.Footer>
      <Button
        variant="outline"
        onclick={() => {
          dialogOpen = false;
        }}
      >
        Cancel
      </Button>
      <Button loading={submitting} onclick={submit}>
        <IconPlus data-slot="button-icon" />
        {editingId ? "Save changes" : "Create destination"}
      </Button>
    </Dialog.Footer>
  </Dialog.Content>
</Dialog.Root>
