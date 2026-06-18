<script lang="ts">
  import * as Card from "@repo/components/ui/card";
  import type { Snippet } from "svelte";

  const {
    title,
    children,
  }: {
    title: string;
    children: Snippet;
  } = $props();
</script>

<Card.Root class="sticky top-0">
  <Card.Header class="pb-3">
    <Card.Title class="text-sm font-medium">{title}</Card.Title>
  </Card.Header>
  <Card.Content class="space-y-3">
    {@render children()}
  </Card.Content>
</Card.Root>
