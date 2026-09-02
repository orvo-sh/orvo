<script lang="ts">
  import { ClaudeCodeIcon } from '@repo/components/icons/claude-code';
  import { CodexIcon } from '@repo/components/icons/codex';
  import { OpenCodeIcon } from '@repo/components/icons/opencode';
  import { Button } from '@repo/components/ui/button';
  import * as Card from '@repo/components/ui/card';
  import { Textarea } from '@repo/components/ui/textarea';
  import {
    IconArrowUp,
    IconArrowUpRight,
    IconChartLine,
    IconFileDescription,
    IconPaperclip,
    IconSearch
  } from '@tabler/icons-svelte';

  const investigationSteps = [
    {
      label: 'Find slow checkout requests',
      tool: 'search_traces',
      icon: IconSearch
    },
    {
      label: 'Inspect the slowest failed trace',
      tool: 'get_trace',
      icon: IconFileDescription
    },
    {
      label: 'Compare checkout latency',
      tool: 'query_metrics',
      icon: IconChartLine
    }
  ];

  const mcpClients = [
    { label: 'Codex', icon: CodexIcon },
    { label: 'Claude Code', icon: ClaudeCodeIcon },
    { label: 'OpenCode', icon: OpenCodeIcon }
  ];
</script>

<Card.Root class="gap-0 overflow-hidden p-0 shadow xl:col-span-12">
  <div class="grid lg:grid-cols-[minmax(0,0.78fr)_minmax(0,1.22fr)]">
    <div class="flex flex-col p-5 sm:p-6 lg:border-r">
      <h2 class="text-secondary-foreground font-sans text-lg font-medium">
        Ask what changed. Follow the evidence.
      </h2>
      <p class="text-muted-foreground mt-1.5 max-w-lg text-base leading-relaxed">
        Scout investigates your logs, traces, metrics, incidents, alerts, and heartbeats, then helps
        you act with approval. External agents get the same investigation context through read-only
        MCP access.
      </p>

      <div class="border-border/70 mt-6 divide-y">
        <a
          href="/docs/product/scout"
          class="flex items-center justify-between gap-4 py-3.5 text-sm font-medium"
        >
          <span>
            <span class="text-primary">How Scout investigates</span>
            <span class="text-muted-foreground mt-0.5 block text-sm font-normal">
              Evidence-led answers and approved actions
            </span>
          </span>
          <IconArrowUpRight class="text-primary size-4" />
        </a>
        <a
          href="/docs/integrations/mcp"
          class="flex items-center justify-between gap-4 py-3.5 text-sm font-medium"
        >
          <span>
            <span class="text-primary">Connect over MCP</span>
            <span class="text-muted-foreground mt-0.5 block text-sm font-normal">
              Scoped, read-only access for your agent
            </span>
          </span>
          <IconArrowUpRight class="text-primary size-4" />
        </a>
      </div>

      <div class="mt-auto pt-6">
        <p class="text-muted-foreground font-mono text-[10px] tracking-wider uppercase">
          MCP works with
        </p>
        <div class="mt-2.5 flex flex-wrap gap-2">
          {#each mcpClients as client (client.label)}
            {@const Icon = client.icon}
            <span
              class="bg-background text-secondary-foreground flex items-center gap-1.5 rounded-full border px-2.5 py-1.5 text-xs font-medium"
            >
              <Icon class="size-3.5" />
              {client.label}
            </span>
          {/each}
        </div>
      </div>
    </div>

    <div class="bg-muted/20 flex min-w-0 flex-col gap-5 p-5">
      <div class="flex-1 space-y-5">
        <div class="flex justify-end">
          <p
            class="bg-muted/55 border-border/70 text-secondary-foreground max-w-[88%] rounded-xl rounded-br-sm border px-3 py-2 text-sm leading-5"
          >
            Checkout latency just spiked. What is slowing it down?
          </p>
        </div>

        <div>
          <div class="space-y-1.5">
            {#each investigationSteps as step (step.tool)}
              {@const Icon = step.icon}
              <div class="text-muted-foreground flex min-w-0 items-center gap-2 py-1.5 text-sm">
                <Icon class="size-3.5 shrink-0" />
                <span class="min-w-0 truncate">
                  {step.label}
                </span>
              </div>
            {/each}
          </div>

          <div class="text-secondary-foreground mt-3 space-y-3 text-sm leading-6">
            <p>Across 18 slow traces, most of the added time comes from the same Postgres span:</p>
            <div class="bg-card overflow-hidden rounded-lg border">
              <div
                class="border-border/70 bg-muted/40 text-muted-foreground border-b px-3 py-1.5 font-mono text-xs uppercase"
              >
                SQL
              </div>
              <pre class="overflow-x-auto p-3 font-mono text-sm leading-6"><code
                  ><span class="text-primary font-medium">SELECT</span> o.id, <span
                    class="text-emerald-700">COALESCE</span
                  >(<span class="text-emerald-700">SUM</span>(i.quantity * i.unit_price), 0) <span
                    class="text-primary font-medium">AS</span
                  > total
<span class="text-primary font-medium">FROM</span> <span class="text-foreground">orders</span
                  > o <span class="text-primary font-medium">LEFT JOIN</span> <span
                    class="text-foreground">order_items</span
                  > i <span class="text-primary font-medium">ON</span> i.order_id = o.id
<span class="text-primary font-medium">WHERE</span> o.customer_id = <span class="text-amber-700"
                    >$1</span
                  > <span class="text-primary font-medium">AND</span> o.created_at &gt;= <span
                    class="text-emerald-700">NOW</span
                  >() - <span class="text-primary font-medium">INTERVAL</span> <span
                    class="text-amber-700">'30 days'</span
                  >
<span class="text-primary font-medium">GROUP BY</span> o.id, o.created_at
<span class="text-primary font-medium">ORDER BY</span> total <span class="text-primary font-medium"
                    >DESC</span
                  >;</code
                ></pre>
            </div>
            <p>
              The query accounts for 612 ms of a 740 ms trace, up from a 48 ms p95 baseline. It is
              the strongest lead; the surrounding checkout work remains steady.
            </p>
          </div>
        </div>
      </div>

      <div class="mt-auto">
        <div
          class="bg-card mx-auto w-full rounded-2xl border p-1.5 shadow-[0_10px_30px_-18px_hsl(var(--foreground)/0.35)]"
        >
          <Textarea
            value="Show me the traces where this query is slow."
            rows={1}
            readonly
            class="field-sizing-content max-h-24 min-h-10 resize-none border-0 bg-transparent px-2.5 py-2 text-sm leading-5 shadow-none focus-visible:ring-0"
            aria-label="Message Scout"
          />
          <div class="flex items-center justify-between gap-2 px-1 pb-0.5">
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              class="rounded-xl"
              aria-label="Attach files"
            >
              <IconPaperclip data-slot="button-icon" />
            </Button>
            <Button type="button" size="icon-sm" class="rounded-xl" aria-label="Send message">
              <IconArrowUp data-slot="button-icon" />
            </Button>
          </div>
        </div>
      </div>
    </div>
  </div>
</Card.Root>
