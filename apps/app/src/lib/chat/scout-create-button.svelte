<script lang="ts">
  import { onMount } from "svelte";
  import { slide } from "svelte/transition";
  import { Button } from "@repo/components/ui/button";
  import { IconSparkle } from "@tabler/icons-svelte";

  let {
    label,
    promptKey,
    promptEnabled = false,
    active = false,
    onclick,
  }: {
    label: string;
    promptKey?: string | number;
    promptEnabled?: boolean;
    active?: boolean;
    onclick: () => void;
  } = $props();
  let expanded = $state(false);
  let duration = $state(250);
  onMount(() => {
    duration = window.matchMedia("(prefers-reduced-motion: reduce)").matches
      ? 0
      : 250;
  });
  $effect(() => {
    expanded = promptEnabled && promptKey !== undefined;
    if (!promptEnabled || promptKey === undefined) return;
    const timer = setTimeout(() => {
      expanded = false;
    }, 2500);
    return () => clearTimeout(timer);
  });
  const slideAndFade = (node: Element) => {
    const transition = slide(node, { axis: "x", duration });
    return {
      ...transition,
      css: (t: number) => `${transition.css?.(t, 1 - t) ?? ""}opacity: ${t};`,
    };
  };
</script>

<Button
  variant="ghost"
  size="icon"
  aria-label={expanded ? label : "Open Scout"}
  aria-pressed={active}
  data-scout-prompt={expanded ? "expanded" : undefined}
  class={[
    "scout-create-prompt w-auto min-w-8 gap-0 p-0",
    (active || expanded) && "border-muted bg-muted text-foreground dark:bg-muted/50",
  ]}
  {onclick}
>
  <span class="flex size-7.5 shrink-0 items-center justify-center"
    ><IconSparkle data-slot="button-icon" /></span
  >
  {#if expanded}
    <span transition:slideAndFade aria-hidden="true"
      ><span class="block pr-2.5 whitespace-nowrap">{label}</span></span
    >
  {/if}
</Button>

<style>
  @property --scout-create-border-angle {
    syntax: "<angle>";
    initial-value: 0deg;
    inherits: false;
  }

  :global(.scout-create-prompt) {
    position: relative;
  }

  :global(.scout-create-prompt)::before {
    content: "";
    position: absolute;
    inset: -1px;
    border-radius: inherit;
    padding: 1px;
    pointer-events: none;
    background: conic-gradient(
      from var(--scout-create-border-angle),
      #60a5fa,
      #22d3ee,
      #4ade80,
      #facc15,
      #fb923c,
      #f472b6,
      #a78bfa,
      #60a5fa
    );
    mask:
      linear-gradient(#fff 0 0) content-box,
      linear-gradient(#fff 0 0);
    mask-composite: exclude;
    opacity: 0;
    transition: opacity 250ms linear;
    animation: scout-border-spin 2s linear infinite paused;
  }

  :global(.scout-create-prompt[data-scout-prompt="expanded"])::before {
    opacity: 1;
    animation-play-state: running;
  }

  @keyframes scout-border-spin {
    to {
      --scout-create-border-angle: 360deg;
    }
  }

  @media (prefers-reduced-motion: reduce) {
    :global(.scout-create-prompt)::before {
      animation: none;
      transition: none;
    }
  }
</style>
