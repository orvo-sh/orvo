<script lang="ts">
  import { getTraceFilterValueSuggestionsQuery } from "$lib/api/traces.remote";
  import {
    getAlertMetricOptionsQuery,
    getContainerNameSuggestionsQuery,
  } from "$lib/api/metrics.remote";
  import SearchValueInput from "./search-value-input.svelte";

  let {
    group,
    label,
    placeholder = "Search values...",
    metricName,
    attributeKey,
    values = $bindable(),
  }: {
    group:
      | "services"
      | "spanNames"
      | "environments"
      | "scopes"
      | "containerNames"
      | "attributeValues";
    metricName?: string;
    attributeKey?: string;
    label: string;
    placeholder?: string;
    values: string[];
  } = $props();

  const loadOptions = async (query: string) => {
    const result =
      metricName && group !== "spanNames"
        ? await getAlertMetricOptionsQuery({
            kind: group,
            metricName,
            attributeKey,
            query,
            limit: 100,
          }).run()
        : group === "containerNames"
          ? await getContainerNameSuggestionsQuery({ query, limit: 100 }).run()
          : await getTraceFilterValueSuggestionsQuery({
              attribute: {
                services: "service.name",
                spanNames: "trace.name",
                environments: "deployment.environment",
                scopes: "scope.name",
              }[group as "services" | "spanNames" | "environments" | "scopes"],
              query,
              limit: 100,
            }).run();
    if (!result.success) return result;
    return {
      success: true as const,
      data: { values: result.data.values.map(({ value }) => ({ value })) },
    };
  };
</script>

<SearchValueInput
  {label}
  {placeholder}
  bind:values
  sourceKey={`${group}:${metricName ?? ""}:${attributeKey ?? ""}`}
  {loadOptions}
/>
