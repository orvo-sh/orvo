<script lang="ts">
  import { goto, invalidateAll } from "$app/navigation";
  import { page } from "$app/state";
  import {
    createEmptyAlertRuleForm,
    type AlertRuleFormValue,
  } from "$lib/alerts";
  import { createAlertRuleCommand } from "$lib/api/alert-rules.remote";
  import PageContainer from "../../_components/page-container/page-container.svelte";
  import AlertRuleForm from "../_components/alert-rule-form.svelte";

  let { data } = $props();

  let submitting = $state(false);
  let error = $state("");
  let form = $state<AlertRuleFormValue>((() => {
    const next = createEmptyAlertRuleForm();
    const signalType = page.url.searchParams.get("signalType");
    const name = page.url.searchParams.get("name");
    const containerNames = page.url.searchParams.get("containerNames");

    if (
      signalType &&
      [
        "container_cpu_utilization",
        "container_memory_utilization",
        "container_reporting_stale",
      ].includes(signalType)
    ) {
      next.signalType = signalType as AlertRuleFormValue["signalType"];
    }

    if (name) {
      next.name = name;
    }

    if (containerNames) {
      next.scope.containerNames.include = containerNames
        .split(",")
        .map((value) => value.trim())
        .filter(Boolean);
    }

    return next;
  })());
  const destinations = $derived(
    data.destinations.map((destination) => ({
      id: destination.id,
      name: destination.name,
      isEnabled: destination.isEnabled,
      kind: destination.kind,
    })),
  );

  const submit = async () => {
    submitting = true;
    error = "";

    const result = await createAlertRuleCommand(form);
    if (result.success === false) {
      error = result.error;
      submitting = false;
      return;
    }

    void invalidateAll();
    await goto(`/a/${page.params.app_id}/alerts/${result.data.id}`);
  };
</script>

<PageContainer title="New alert rule">
  <AlertRuleForm
    bind:form
    {destinations}
    {submitting}
    {error}
    submitLabel="Create rule"
    onSubmit={submit}
  />
</PageContainer>
