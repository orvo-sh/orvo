<script lang="ts">
  import { Badge } from '@repo/components/ui/badge';
  import * as Card from '@repo/components/ui/card';
  import { IconBraces, IconCircleCheck, IconPlugConnected } from '@tabler/icons-svelte';
</script>

<Card.Root class="justify-between gap-0 overflow-hidden p-0 shadow-none xl:col-span-4">
  <div class="p-5 pb-0">
    <div class="flex items-center justify-between gap-3">
      <h2 class="text-secondary-foreground flex items-center gap-2 text-lg font-medium">
        <IconPlugConnected class="text-primary size-6" />
        MCP
      </h2>
      <Badge variant="outline" class="rounded-full px-2 text-[10px] font-medium">Available</Badge>
    </div>
    <p class="text-muted-foreground mt-1.5 text-base leading-relaxed">
      Give compatible agents scoped access to search logs, inspect traces, query metrics, and
      understand incidents with the context intact.
    </p>
  </div>

  <div class="p-5 pt-4">
    <div
      class="bg-foreground text-background overflow-hidden rounded-lg border font-mono text-xs shadow-sm"
    >
      <div
        class="border-background/10 text-background/55 flex items-center gap-2 border-b px-3 py-2"
      >
        <IconBraces class="size-3.5" />
        agent session
      </div>
      <div class="space-y-2.5 p-3.5">
        <p><span class="text-background/45">›</span> find recent checkout errors</p>
        <p class="text-background/55">
          → search_traces <span class="text-background/35">{`{ status: "error" }`}</span>
        </p>
        <p class="text-background/55">
          → search_logs <span class="text-background/35">{`{ trace_id: "9r3k…" }`}</span>
        </p>
        <div class="border-background/10 flex items-center gap-2 border-t pt-2.5 text-emerald-300">
          <IconCircleCheck class="size-3.5" />
          2 tools · scoped read access
        </div>
      </div>
    </div>
  </div>
</Card.Root>
