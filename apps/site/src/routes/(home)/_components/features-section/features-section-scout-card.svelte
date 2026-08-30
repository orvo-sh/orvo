<script lang="ts">
  import { ClaudeCodeIcon } from '@repo/components/icons/claude-code';
  import { CodexIcon } from '@repo/components/icons/codex';
  import { OpenCodeIcon } from '@repo/components/icons/opencode';
  import { Button } from '@repo/components/ui/button';
  import * as Card from '@repo/components/ui/card';
  import { IconArrowUp, IconArrowUpRight, IconCheck, IconLoader2 } from '@tabler/icons-svelte';

  const toolCalls = [
    {
      name: 'trace.search',
      detail: 'checkout-api, ±10m around deploy',
      time: '1.2s',
      status: 'done'
    },
    {
      name: 'logs.query',
      detail: 'service:checkout-api level:error',
      time: '0.8s',
      status: 'done'
    },
    {
      name: 'metrics.compare',
      detail: 'p95 latency, before vs. after deploy',
      time: null,
      status: 'running'
    }
  ];

  const mcpClients = [
    { label: 'Codex', icon: CodexIcon },
    { label: 'Claude Code', icon: ClaudeCodeIcon },
    { label: 'OpenCode', icon: OpenCodeIcon }
  ];
</script>

<Card.Root class="justify-between gap-0 overflow-hidden p-0 shadow md:col-span-6 xl:col-span-12">
  <div class="p-5 pb-0">
    <h2 class="text-secondary-foreground font-sans text-lg font-medium">Scout &amp; MCP</h2>
    <p class="text-muted-foreground mt-1.5 max-w-2xl text-base leading-relaxed">
      <a
        href="/docs/product/scout"
        class="text-primary inline-flex items-center text-base underline-offset-4 hover:underline"
      >
        Ask Scout
        <IconArrowUpRight class="mb-2 ml-1 inline-flex size-3.5" />
      </a>
      what went wrong and get answers grounded in your logs, traces, metrics, and more. Or connect Codex,
      Claude Code, OpenCode, and other compatible agents through
      <a
        href="/docs/integrations/mcp"
        class="text-primary inline-flex items-center text-base underline-offset-4 hover:underline"
      >
        MCP
        <IconArrowUpRight class="mb-2 ml-1 inline-flex size-3.5" />
      </a>
      to investigate with the same context.
    </p>
  </div>

  <div class="p-5 pt-4">
    <div class="bg-background border-foreground/10 overflow-hidden rounded-lg border">
      <div class="flex flex-col gap-2.5 px-3.5 pt-3.5 pb-3">
        <p
          class="bg-muted/45 border-border/70 text-secondary-foreground max-w-[82%] self-end rounded-lg border px-2.5 py-1.5 text-xs"
        >
          Why did checkout errors spike after the latest deployment?
        </p>

        <div
          class="text-secondary-foreground mt-1 flex items-center gap-1.5 text-[11px] font-medium tracking-wide uppercase"
        >
          <span class="bg-primary size-1.5 rounded-[3px]"></span>
          Scout
        </div>

        <div class="flex flex-col gap-1.5">
          {#each toolCalls as toolCall (toolCall.name)}
            <div
              class="border-border/70 bg-muted/25 flex items-center gap-2 rounded-md border px-2.5 py-1.5 font-mono text-[11px]"
            >
              {#if toolCall.status === 'done'}
                <span
                  class="flex size-3.5 shrink-0 items-center justify-center rounded-full bg-emerald-500/15"
                >
                  <IconCheck class="size-2.5 text-emerald-600" />
                </span>
              {:else}
                <IconLoader2
                  class="text-primary size-3.5 shrink-0 animate-spin motion-reduce:animate-none"
                />
              {/if}
              <span class="text-secondary-foreground font-medium">{toolCall.name}</span>
              <span class="text-border">·</span>
              <span class="text-muted-foreground truncate">{toolCall.detail}</span>
              {#if toolCall.time}
                <span class="text-muted-foreground/60 ml-auto shrink-0 tabular-nums"
                  >{toolCall.time}</span
                >
              {/if}
            </div>
          {/each}
        </div>

        <p
          class="border-primary/60 text-secondary-foreground border-l-2 pl-2.5 text-xs leading-relaxed"
        >
          Errors started <code
            class="bg-muted border-foreground/10 text-primary rounded border px-1 py-px font-mono text-[11px]"
            >3m</code
          >
          after
          <code
            class="bg-muted border-foreground/10 text-primary rounded border px-1 py-px font-mono text-[11px]"
            >checkout-api</code
          >
          deployed. Failures cluster on payment requests timing out on Postgres — p95 db latency jumped
          from
          <code
            class="bg-muted border-foreground/10 text-primary rounded border px-1 py-px font-mono text-[11px]"
            >42ms → 680ms</code
          >.
        </p>
      </div>

      <div class="border-border/70 flex items-center gap-1.5 border-t px-3 py-2.5">
        <span class="text-muted-foreground rounded-md border px-2 py-1 text-[11px]">Production</span
        >
        <span class="text-muted-foreground rounded-md border px-2 py-1 text-[11px]">Last hour</span>
        <span class="text-muted-foreground min-w-0 flex-1 truncate pl-1 text-xs"
          >Ask Scout about your telemetry…</span
        >
        <Button size="icon" class="size-7 shrink-0 rounded-md" aria-label="Send example question">
          <IconArrowUp data-slot="button-icon" class="size-3.5" />
        </Button>
      </div>

      <div class="bg-muted/25 border-border/70 border-t px-3.5 py-2.5">
        <div class="flex flex-wrap items-center gap-x-4 gap-y-2">
          <span class="text-muted-foreground text-xs">MCP works with</span>
          {#each mcpClients as client (client.label)}
            {@const Icon = client.icon}
            <span class="text-secondary-foreground flex items-center gap-1.5 text-xs font-medium">
              <Icon class="size-4" />
              {client.label}
            </span>
          {/each}
        </div>
      </div>
    </div>
  </div>
</Card.Root>
