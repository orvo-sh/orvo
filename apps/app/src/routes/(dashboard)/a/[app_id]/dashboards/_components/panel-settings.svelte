<script lang="ts">
  import type { DashboardPanel } from "$lib/dashboards/schema";
  import { Input } from "@repo/components/ui/input";
  import { Label } from "@repo/components/ui/label";
  import { Textarea } from "@repo/components/ui/textarea";
  import SelectField from "./select-field.svelte";
  let {
    panel,
    onchange,
    horizontal = false,
  }: {
    panel: DashboardPanel;
    horizontal?: boolean;
    onchange: (patch: Partial<DashboardPanel>) => void;
  } = $props();
  const id = $props.id();
</script>

<div
  class={horizontal
    ? "grid grid-cols-1 items-start gap-5 p-4 sm:grid-cols-2 xl:grid-cols-4"
    : "space-y-5 p-4"}
>
  <div class="space-y-2">
    <Label for={`${id}-title`}>Title</Label><Input
      id={`${id}-title`}
      value={panel.title}
      maxlength={120}
      oninput={(event) => onchange({ title: event.currentTarget.value })}
    />
  </div>
  <SelectField
    label="Visualization"
    value={panel.visualization}
    options={[
      { value: "time_series", label: "Time series" },
      { value: "stat", label: "Stat" },
      { value: "table", label: "Table" },
      { value: "bar", label: "Bar chart" },
      { value: "logs", label: "Logs" },
      { value: "text", label: "Text" },
    ]}
    onchange={(value) =>
      onchange({
        visualization: value as DashboardPanel["visualization"],
        ...(value === "logs" ? { source: "logs", measure: "count" } : {}),
      })}
  />
  {#if panel.visualization === "text"}
    <div class="space-y-2">
      <Label for={`${id}-text`}>Text</Label><Textarea
        id={`${id}-text`}
        value={panel.text}
        rows={8}
        maxlength={10000}
        oninput={(event) => onchange({ text: event.currentTarget.value })}
      />
    </div>
  {:else}
    {#if panel.visualization !== "logs"}<SelectField
        label="Data source"
        value={panel.source}
        options={[
          { value: "traces", label: "Traces" },
          { value: "logs", label: "Logs" },
          { value: "metrics", label: "Metrics" },
        ]}
        onchange={(value) =>
          onchange({
            source: value as DashboardPanel["source"],
            measure: value === "metrics" ? "value" : "count",
            aggregation: "avg",
            groupBy: "none",
          })}
      />{/if}
    {#if panel.source === "metrics"}
      <div class="space-y-2">
        <Label for={`${id}-metric`}>Metric name</Label><Input
          id={`${id}-metric`}
          value={panel.metricName}
          placeholder="http.server.request.duration"
          maxlength={255}
          oninput={(event) =>
            onchange({ metricName: event.currentTarget.value })}
        />
      </div>
    {:else if panel.visualization !== "logs"}
      <SelectField
        label="Measure"
        value={panel.measure}
        options={[
          {
            value: "count",
            label: panel.source === "traces" ? "Span count" : "Log count",
          },
          { value: "error_rate", label: "Error rate" },
          ...(panel.source === "traces"
            ? [
                { value: "duration", label: "Duration" },
                { value: "input_tokens", label: "Input tokens" },
                { value: "output_tokens", label: "Output tokens" },
                { value: "total_tokens", label: "Total tokens" },
              ]
            : []),
        ]}
        onchange={(value) =>
          onchange({
            measure: value as DashboardPanel["measure"],
            aggregation: value.endsWith("_tokens")
              ? "sum"
              : value === "duration"
                ? "p95"
                : "avg",
          })}
      />
    {/if}
    {#if panel.measure === "duration" || panel.measure === "value"}
      <SelectField
        label="Aggregation"
        value={panel.aggregation}
        options={[
          { value: "avg", label: "Average" },
          { value: "min", label: "Minimum" },
          { value: "max", label: "Maximum" },
          ...(panel.source === "traces"
            ? [
                { value: "p50", label: "p50" },
                { value: "p95", label: "p95" },
                { value: "p99", label: "p99" },
              ]
            : [{ value: "sum", label: "Sum" }]),
        ]}
        onchange={(value) =>
          onchange({ aggregation: value as DashboardPanel["aggregation"] })}
      />
    {/if}
    <div class="space-y-2">
      <Label for={`${id}-service`}>Service</Label><Input
        id={`${id}-service`}
        value={panel.service}
        placeholder="All services"
        maxlength={255}
        oninput={(event) => onchange({ service: event.currentTarget.value })}
      />
    </div>
    <div class="space-y-2">
      <Label for={`${id}-environment`}>Environment</Label><Input
        id={`${id}-environment`}
        value={panel.environment}
        placeholder="All environments"
        maxlength={255}
        oninput={(event) =>
          onchange({ environment: event.currentTarget.value })}
      />
    </div>
    {#if panel.visualization !== "logs"}
      {#if panel.source === "traces"}
        <div class="space-y-2">
          <Label for={`${id}-model`}>Model</Label><Input
            id={`${id}-model`}
            value={panel.model ?? ""}
            placeholder="All models"
            maxlength={255}
            oninput={(event) => onchange({ model: event.currentTarget.value })}
          />
        </div>
        <div class="space-y-2">
          <Label for={`${id}-provider`}>Provider</Label><Input
            id={`${id}-provider`}
            value={panel.provider ?? ""}
            placeholder="All providers"
            maxlength={255}
            oninput={(event) =>
              onchange({ provider: event.currentTarget.value })}
          />
        </div>
      {/if}
      <SelectField
        label="Group by"
        value={panel.groupBy}
        options={[
          { value: "none", label: "None" },
          { value: "service", label: "Service" },
          ...(panel.source === "traces"
            ? [
                { value: "model", label: "Model" },
                { value: "provider", label: "Provider" },
              ]
            : []),
          ...(panel.source === "metrics"
            ? [{ value: "host", label: "Host" }]
            : []),
        ]}
        onchange={(value) =>
          onchange({ groupBy: value as DashboardPanel["groupBy"] })}
      />
      <SelectField
        label="Unit"
        value={panel.unit}
        options={[
          { value: "auto", label: "Auto" },
          { value: "tokens", label: "Tokens" },
          { value: "ms", label: "Milliseconds" },
          { value: "s", label: "Seconds" },
          { value: "%", label: "Percent" },
          { value: "bytes", label: "Bytes" },
        ]}
        onchange={(value) =>
          onchange({ unit: value as DashboardPanel["unit"] })}
      />
    {/if}
  {/if}
  <div class="grid grid-cols-2 gap-3 border-t pt-4">
    <div class="space-y-2">
      <Label for={`${id}-width`}>Width</Label><Input
        id={`${id}-width`}
        type="number"
        min={4}
        max={24 - panel.x}
        value={panel.w}
        oninput={(event) => {
          if (event.currentTarget.valueAsNumber)
            onchange({ w: event.currentTarget.valueAsNumber });
        }}
      />
    </div>
    <div class="space-y-2">
      <Label for={`${id}-height`}>Height</Label><Input
        id={`${id}-height`}
        type="number"
        min={3}
        max={30}
        value={panel.h}
        oninput={(event) => {
          if (event.currentTarget.valueAsNumber)
            onchange({ h: event.currentTarget.valueAsNumber });
        }}
      />
    </div>
  </div>
</div>
