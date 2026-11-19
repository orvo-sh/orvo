<script lang="ts">
  import { getAlertMetricOptionsQuery } from "$lib/api/metrics.remote";
  import SearchValueInput from "./search-value-input.svelte";

  let {
    kind = "metrics",
    metricName,
    value = null,
    onSelect,
    label = "Choose a metric",
    disabled = false,
    excludeValues = [],
    focusOnMount = false,
  }: {
    kind?: "metrics" | "attributeKeys";
    metricName?: string;
    value?: string | null;
    onSelect: (
      value: string,
      unit: string,
      metric: { type: string; isMonotonic: boolean },
    ) => void;
    label?: string;
    disabled?: boolean;
    excludeValues?: string[];
    focusOnMount?: boolean;
  } = $props();

  const loadOptions = async (query: string) => {
    const result = await getAlertMetricOptionsQuery({
      kind,
      metricName,
      query,
      limit: 100,
    }).run();
    if (!result.success) return result;
    return {
      success: true as const,
      data: {
        values: result.data.values
          .filter((option) => !excludeValues.includes(option.value))
          .map((option) => ({
            value: option.value,
            unit: kind === "metrics" ? option.unit : undefined,
            type: kind === "metrics" ? option.type : undefined,
            isMonotonic: option.isMonotonic,
          })),
      },
    };
  };
</script>

<SearchValueInput
  {label}
  placeholder={kind === "metrics"
    ? "Search metrics..."
    : "Search attributes..."}
  values={value ? [value] : []}
  multiple={false}
  {disabled}
  {focusOnMount}
  sourceKey={`${kind}:${metricName ?? ""}`}
  {loadOptions}
  onSelect={(option) =>
    onSelect(option.value, option.unit ?? "", {
      type: option.type ?? "gauge",
      isMonotonic: option.isMonotonic ?? false,
    })}
  emptyMessage={kind === "metrics"
    ? "No matching metrics found in this app."
    : "No matching metric attributes found."}
/>
