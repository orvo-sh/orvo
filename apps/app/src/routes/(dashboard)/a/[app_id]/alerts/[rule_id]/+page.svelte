<script lang="ts">
  import { goto } from "$app/navigation";
  import { page } from "$app/state";
  import { type AlertRuleFormValue } from "$lib/alerts";
  import {
    deleteAlertRuleCommand,
    updateAlertRuleCommand,
  } from "$lib/api/alert-rules.remote";
  import { Button } from "@repo/components/ui/button";
  import PageContainer from "../../_components/page-container/page-container.svelte";
  import AlertRuleForm from "../_components/alert-rule-form.svelte";

  let { data } = $props();

  let submitting = $state(false);
  let deleting = $state(false);
  let error = $state("");
  let form = $state<AlertRuleFormValue>({
    name: data.rule.name,
    signalType: data.rule.signalType,
    comparator: data.rule.comparator,
    threshold: data.rule.threshold,
    windowMinutes: data.rule.windowMinutes,
    renotifyMinutes: data.rule.renotifyMinutes,
    apdexTargetMs: data.rule.apdexTargetMs,
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
  });
  const destinations = $derived(
    data.destinations.map((destination) => ({
      id: destination.id,
      name: destination.name,
      isEnabled: destination.isEnabled,
      kind: destination.kind,
    })),
  );

  const ruleId = $derived(page.params.rule_id ?? "");

  const submit = async () => {
    submitting = true;
    error = "";

    const result = await updateAlertRuleCommand({
      id: ruleId,
      ...form,
    });

    if (result.success === false) {
      error = result.error;
      submitting = false;
      return;
    }

    submitting = false;
  };

  const deleteRule = async () => {
    const confirmed = window.confirm("Delete this alert rule?");
    if (!confirmed) {
      return;
    }

    deleting = true;
    error = "";

    const result = await deleteAlertRuleCommand(ruleId);
    if (result.success === false) {
      error = result.error;
      deleting = false;
      return;
    }

    await goto(`/a/${page.params.app_id}/alerts`);
  };
</script>

<PageContainer title="Edit alert rule">
  {#snippet actions()}
    <Button variant="destructive" loading={deleting} onclick={deleteRule}
      >Delete</Button
    >
  {/snippet}

  <AlertRuleForm
    bind:form
    {destinations}
    {submitting}
    {error}
    submitLabel="Save rule"
    onSubmit={submit}
  />
</PageContainer>
