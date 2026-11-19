<script lang="ts">
  import * as Select from "@repo/components/ui/select";
  import { Label } from "@repo/components/ui/label";
  let {
    label,
    value,
    options,
    onchange,
  }: {
    label: string;
    value: string;
    options: { value: string; label: string }[];
    onchange: (value: string) => void;
  } = $props();
  const id = $props.id();
</script>

<div class="space-y-2">
  {#if label}<Label for={id}>{label}</Label>{/if}<Select.Root
    type="single"
    {value}
    onValueChange={(next) => {
      if (next) onchange(next);
    }}
    ><Select.Trigger {id} aria-label={label || "Time range"} class="w-full"
      >{options.find((option) => option.value === value)?.label ??
        value}</Select.Trigger
    ><Select.Content
      >{#each options as option (option.value)}<Select.Item value={option.value}
          >{option.label}</Select.Item
        >{/each}</Select.Content
    ></Select.Root
  >
</div>
