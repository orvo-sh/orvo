<script lang="ts">
  import {
    afterNavigate,
    beforeNavigate,
    onNavigate,
    goto,
    invalidateAll,
  } from "$app/navigation";
  import { page } from "$app/state";
  import {
    getAlertRuleFormFingerprint,
    type AlertRuleFormValue,
  } from "$lib/alerts";
  import {
    deleteAlertRuleCommand,
    discardAlertRuleDraftCommand,
    touchAlertRuleDraftCommand,
    setAlertRuleEnabledCommand,
    updateAlertRuleCommand,
  } from "$lib/api/alert-rules.remote";
  import * as Chat from "$lib/chat";
  import ScoutCreateButton from "$lib/chat/scout-create-button.svelte";
  import { onMount, tick, untrack } from "svelte";
  import { getRuleSuggestions } from "$lib/alerts/rule-suggestions";
  import { createRuleEditorController } from "$lib/alerts/rule-editor-controller";
  import { getAlertMetricOptionsQuery } from "$lib/api/metrics.remote";
  import {
    createNotificationDestinationCommand,
    getNotificationDestinationsQuery,
  } from "$lib/api/notification-destinations.remote";
  import { createNotificationDestinationInputSchema } from "$lib/notification-destination-schema";
  import { IconDots, IconActivity, IconTrash } from "@tabler/icons-svelte";
  import * as AlertDialog from "@repo/components/ui/alert-dialog";
  import * as DropdownMenu from "@repo/components/ui/dropdown-menu";
  import { genId } from "@repo/utils";
  import { toast } from "@repo/components/ui/sonner";
  import { Button } from "@repo/components/ui/button";
  import PageContainer from "../../_components/page-container/page-container.svelte";
  import AlertRuleForm from "../_components/alert-rule-form.svelte";

  let { data } = $props();

  const chat = Chat.useChatState();
  let openingScout = $state(false);
  const askScout = async () => {
    if (openingScout) return;
    openingScout = true;
    try {
      await chat.openContext($state.snapshot(ruleChatContext));
    } finally {
      openingScout = false;
    }
  };

  let submitting = $state(false);
  let deleting = $state(false);
  let toggling = $state(false);
  let error = $state("");
  const createEditorForm = () => {
    const next: AlertRuleFormValue = {
      metricType: data.rule.metricType,
      metricIsMonotonic: data.rule.metricIsMonotonic,
      metricName: data.rule.metricName,
      metricAggregation: data.rule
        .metricAggregation as AlertRuleFormValue["metricAggregation"],
      metricUnit: data.rule.metricUnit,
      metricAttributeFilters: data.rule.metricAttributeFilters,
      name: data.rule.name,

      comparator: data.rule.comparator,
      threshold: data.rule.threshold,
      windowMinutes: data.rule.windowMinutes,
      renotifyMinutes: data.rule.renotifyMinutes,
      scope: {
        services: {
          include: data.rule.scopeServicesInclude,
          exclude: data.rule.scopeServicesExclude,
        },
        spanNames: {
          include: data.rule.scopeSpanNamesInclude,
          exclude: data.rule.scopeSpanNamesExclude,
        },
        environments: {
          include: data.rule.scopeEnvironmentsInclude,
          exclude: data.rule.scopeEnvironmentsExclude,
        },
        scopes: {
          include: data.rule.scopeScopesInclude,
          exclude: data.rule.scopeScopesExclude,
        },
        containerNames: {
          include: data.rule.scopeContainerNamesInclude,
          exclude: data.rule.scopeContainerNamesExclude,
        },
      },
      destinationIds: data.rule.destinationIds,
    };
    if (data.rule.isDraft) {
      next.name = page.url.searchParams.get("name") ?? next.name;
      const containers = page.url.searchParams.get("containerNames");
      if (containers)
        next.scope.containerNames.include = containers
          .split(",")
          .map((value) => value.trim())
          .filter(Boolean);
    }

    return $state.snapshot(next);
  };
  let form = $state<AlertRuleFormValue>(createEditorForm());

  const ruleChatContext = $derived({
    kind: "alert_rule",
    resourceId: data.rule.id,
    label: form.name || "Untitled rule",
    metadata: {
      metricName: form.metricName,
      metricAggregation: form.metricAggregation,
      isDraft: data.rule.isDraft,
      name: form.name,

      comparator: form.comparator,
      threshold: form.threshold,
      windowMinutes: form.windowMinutes,
      renotifyMinutes: form.renotifyMinutes,
      instruction: "Use the connected live rule editor to configure this rule.",
    },
  } satisfies Chat.ChatContextDescriptor);

  let savedFingerprint = $state(getAlertRuleFormFingerprint(form));
  let loadedRuleId = data.rule.id;
  const dirty = $derived(
    getAlertRuleFormFingerprint(form) !== savedFingerprint,
  );
  let allowLeave = false;
  let leaveOpen = $state(false);
  let leaveTarget = $state<{ href: string; delta?: number } | null>(null);

  afterNavigate(() => {
    allowLeave = false;
    if (loadedRuleId !== data.rule.id) {
      form = createEditorForm();
      savedFingerprint = getAlertRuleFormFingerprint(form);
      loadedRuleId = data.rule.id;
    }
  });

  beforeNavigate((navigation) => {
    if (allowLeave) return;
    if (
      !navigation.willUnload &&
      navigation.to?.url.pathname === navigation.from?.url.pathname
    )
      return;
    if (submitting) {
      navigation.cancel();
      if (!navigation.willUnload)
        toast.info("Wait for the rule to finish saving.");
      return;
    }
    if (!dirty) return;
    navigation.cancel();
    if (navigation.willUnload) return;
    if (navigation.to) {
      leaveTarget = {
        href: navigation.to.url.href,
        delta: navigation.type === "popstate" ? navigation.delta : undefined,
      };
      leaveOpen = true;
    }
  });

  onNavigate(async (navigation) => {
    if (
      !data.rule.isDraft ||
      (!allowLeave && dirty) ||
      navigation.to?.url.pathname === navigation.from?.url.pathname
    )
      return;
    try {
      await discardAlertRuleDraftCommand(data.rule.id);
    } catch {
      // Daily cleanup handles a draft if the navigation-time request fails.
    }
  });

  onMount(() => {
    const touchDraft = () => {
      if (data.rule.isDraft && document.visibilityState === "visible") {
        void touchAlertRuleDraftCommand(data.rule.id).catch(() => {});
      }
    };
    touchDraft();
    const timer = setInterval(touchDraft, 5 * 60 * 1000);
    document.addEventListener("visibilitychange", touchDraft);
    return () => {
      clearInterval(timer);
      document.removeEventListener("visibilitychange", touchDraft);
    };
  });

  const discardAndLeave = async () => {
    if (!leaveTarget) return;
    const target = leaveTarget;
    leaveOpen = false;
    allowLeave = true;
    try {
      if (target.delta !== undefined && target.delta !== 0) {
        window.history.go(target.delta);
      } else {
        await goto(target.href);
      }
    } catch {
      allowLeave = false;
      error = "Could not navigate away. Try again.";
    }
  };

  let destinationOptions = $state(data.destinations);
  let activeRuleTab = $state<"condition" | "scope" | "notifications">(
    "condition",
  );
  let scoutUpdate = $state<{
    tab: string;
    fields: string[];
    sequence: number;
  } | null>(null);
  $effect(() => {
    destinationOptions = data.destinations;
  });

  const destinations = $derived(
    destinationOptions.map((destination) => ({
      id: destination.id,
      name: destination.name,
      isEnabled: destination.isEnabled,
      kind: destination.kind,
      detail:
        destination.kind === "email"
          ? destination.emailRecipients.join(", ")
          : destination.kind === "slack"
            ? destination.slackChannelName
              ? `#${destination.slackChannelName.replace(/^#/, "")}`
              : ""
            : destination.webhookUrl
              ? new URL(destination.webhookUrl).hostname
              : "",
    })),
  );

  const ruleId = $derived(page.params.rule_id ?? "");

  const saveForm = async (savedForm: AlertRuleFormValue) => {
    if (submitting || deleting || toggling)
      return { success: false, error: "Another rule action is in progress." };
    submitting = true;
    error = "";
    try {
      const result = await updateAlertRuleCommand({
        id: ruleId,
        ...savedForm,
      });
      if (!result.success) {
        error = result.error;
        return result;
      }
      savedFingerprint = getAlertRuleFormFingerprint(savedForm);
      await invalidateAll();
      return { success: true };
    } catch {
      error =
        "Failed to save alert rule. Check the rule configuration and try again.";
      return { success: false, error };
    } finally {
      submitting = false;
    }
  };

  $effect(() => {
    chat.ruleEditorPrompts = getRuleSuggestions(form, data.rule.isDraft);
    if (chat.railOpen) chat.context = $state.snapshot(ruleChatContext);
    return () => {
      chat.ruleEditorPrompts = [];
    };
  });

  const submit = async () => {
    await saveForm($state.snapshot(form));
  };

  $effect(() => {
    const id = data.rule.id;
    let active = true;
    const controller = untrack(() =>
      createRuleEditorController({
        editorId: genId("editor"),
        ruleId: id,
        isActive: () => active && data.rule.id === id,
        getForm: () => $state.snapshot(form),
        setForm: (next) => {
          form = next;
        },
        getTab: () => activeRuleTab,
        getDestinations: () => $state.snapshot(destinations),
        reveal: async (tab, fields) => {
          activeRuleTab = tab;
          scoutUpdate = {
            tab,
            fields,
            sequence: (scoutUpdate?.sequence ?? 0) + 1,
          };
          await tick();
        },
        loadMetric: async (name) => {
          const result = await getAlertMetricOptionsQuery({
            kind: "metrics",
            query: name,
            limit: 100,
          }).run();
          if (!result.success) throw new Error(result.error);
          const metric = result.data.values.find((item) => item.value === name);
          return metric
            ? {
                type: metric.type ?? "gauge",
                unit: metric.unit ?? "",
                isMonotonic: metric.isMonotonic ?? false,
              }
            : null;
        },
        refreshDestinations: async () => {
          const result = await getNotificationDestinationsQuery({}).run();
          if (!result.success) throw new Error(result.error);
          if (active) destinationOptions = result.data.destinations;
        },
        createDestination: async (input) => {
          const parsed = createNotificationDestinationInputSchema.parse(input);
          return createNotificationDestinationCommand(parsed);
        },
        save: saveForm,
      }),
    );
    chat.ruleEditor = controller;
    return () => {
      active = false;
      if (chat.ruleEditor === controller) chat.ruleEditor = null;
    };
  });

  const toggleRule = async () => {
    if (submitting || deleting || toggling || data.rule.isDraft) return;
    toggling = true;
    error = "";
    try {
      const isEnabled = !data.rule.isEnabled;
      const result = await setAlertRuleEnabledCommand({
        id: ruleId,
        isEnabled,
      });
      if (!result.success) {
        error = result.error;
        return;
      }
      await invalidateAll();
      toast.success(isEnabled ? "Alert rule enabled." : "Alert rule disabled.");
    } catch {
      error = "Failed to update alert rule.";
    } finally {
      toggling = false;
    }
  };

  const deleteRule = async () => {
    if (submitting || deleting || toggling) return;
    if (!window.confirm("Delete this alert rule?")) return;
    deleting = true;
    error = "";
    try {
      const result = await deleteAlertRuleCommand(ruleId);
      if (!result.success) {
        error = result.error;
        return;
      }
      allowLeave = true;
      await goto(`/a/${page.params.app_id}/alerts`);
    } catch {
      error = "Failed to delete alert rule.";
    } finally {
      deleting = false;
    }
  };
</script>

<PageContainer
  title={data.rule.name || "Untitled rule"}
  back={{ href: `/a/${page.params.app_id}/alerts`, title: "Alerts" }}
>
  {#snippet actions()}
    <DropdownMenu.Root>
      <DropdownMenu.Trigger>
        {#snippet child({ props })}
          <Button
            {...props}
            variant="ghost"
            size="icon-sm"
            aria-label="Rule actions"
            loading={deleting || toggling}
            disabled={submitting || deleting || toggling}
          >
            <IconDots data-slot="button-icon" />
          </Button>
        {/snippet}
      </DropdownMenu.Trigger>
      <DropdownMenu.Content align="end" class="w-40">
        <DropdownMenu.Item
          disabled={data.rule.isDraft || submitting || deleting || toggling}
          onSelect={() => void toggleRule()}
        >
          <IconActivity />
          {data.rule.isEnabled ? "Disable rule" : "Enable rule"}
        </DropdownMenu.Item>
        <DropdownMenu.Separator />
        <DropdownMenu.Item
          variant="destructive"
          disabled={submitting || deleting || toggling}
          onSelect={() => void deleteRule()}
        >
          <IconTrash />
          Delete rule
        </DropdownMenu.Item>
      </DropdownMenu.Content>
    </DropdownMenu.Root>
    <Button
      loading={submitting}
      disabled={deleting || toggling}
      onclick={submit}
    >
      Save rule
    </Button>
    <ScoutCreateButton
      label="Describe a rule with Scout"
      promptEnabled={!data.hasCreatedAlertRule}
      promptKey={data.rule.isDraft && page.state.newAlertRule
        ? data.rule.id
        : undefined}
      active={chat.railOpen}
      onclick={() => void askScout()}
    />
  {/snippet}

  {#if !data.rule.isDraft && data.rule.lastEvaluationStatus === "no_data"}
    <p class="px-3 pt-3 text-sm text-muted-foreground sm:px-5" role="status">
      No matching gauge data was available at the last evaluation. Existing
      incidents stay open until matching data confirms recovery.
    </p>
  {/if}

  <AlertRuleForm
    bind:form
    bind:activeTab={activeRuleTab}
    {scoutUpdate}
    {destinations}
    notificationSettingsHref={`/a/${page.params.app_id}/settings/notification-destinations`}
    {error}
  />
</PageContainer>

<AlertDialog.Root bind:open={leaveOpen}>
  <AlertDialog.Content>
    <AlertDialog.Header>
      <AlertDialog.Title>Discard unsaved changes?</AlertDialog.Title>
      <AlertDialog.Description>
        {data.rule.isDraft
          ? "This rule has not been saved. Leaving will discard the draft and your changes."
          : "Your changes have not been saved. Leaving will discard them."}
      </AlertDialog.Description>
    </AlertDialog.Header>
    <AlertDialog.Footer>
      <AlertDialog.Cancel>Keep editing</AlertDialog.Cancel>
      <AlertDialog.Action
        variant="destructive"
        onclick={() => void discardAndLeave()}
      >
        Discard changes
      </AlertDialog.Action>
    </AlertDialog.Footer>
  </AlertDialog.Content>
</AlertDialog.Root>
