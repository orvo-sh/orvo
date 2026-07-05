<script lang="ts">
  import { Chatgpt, ClaudeCode, cn, Codex } from '@repo/components';
  import { Badge } from '@repo/components/ui/badge';
  import * as Card from '@repo/components/ui/card';
  import { IconBolt } from '@tabler/icons-svelte';

  const mcpClients = [
    { label: 'ChatGPT', icon: Chatgpt.Root, iconClass: 'text-foreground' },
    { label: 'Codex', icon: Codex.Root, iconClass: 'text-foreground' },
    { label: 'Claude Code', icon: ClaudeCode.Root, iconClass: '' }
  ];

  const terminalOutput = [
    "I'll check Orvo for the signals that are actively failing in checkout.",
    '',
    '• Found 2 firing alerts in `api-checkout`',
    '• Found 1 open incident linked to elevated p95 latency',
    '• Trace regressions started 7 minutes ago after the latest deploy',
    '',
    'Next steps:',
    '1. Open `api-checkout latency spike`',
    '2. Follow `POST /api/checkout/confirm` through the failing span'
  ];
</script>

<Card.Root
  class="bg-card/90 border-foreground/10 justify-between gap-0 p-0 md:col-span-2 xl:col-span-8"
>
  <div class="p-5 pb-0">
    <h2 class="text-secondary-foreground flex items-center gap-2 text-lg font-medium">
      <IconBolt class="text-primary size-6" />
      MCP
    </h2>
    <p class="text-muted-foreground mt-1.5 max-w-[86%] text-base leading-relaxed">
      Connect Orvo to agent clients over Model Context Protocol so they can inspect alerts,
      incidents, logs, traces, and heartbeats from the terminal without extra glue code.
    </p>

    <div class="mt-4 flex flex-wrap items-center gap-2.5">
      <span class="text-muted-foreground text-xs font-medium">Works with</span>
      {#each mcpClients as client (client.label)}
        {@const Icon = client.icon}
        <Badge
          variant="outline"
          class="border-border/70 bg-background/85 text-secondary-foreground gap-2 rounded-md px-2.5 py-1.5 text-xs font-medium"
        >
          <Icon class={cn('size-4', client.iconClass)} />
          {client.label}
        </Badge>
      {/each}
    </div>
  </div>

  <div class="px-5 pt-4 pb-5">
    <div
      class="overflow-hidden rounded-[1.35rem] border border-zinc-700/80 bg-[#222228] shadow-[0_18px_50px_rgba(15,15,20,0.28)]"
    >
      <div class="flex h-10 items-center justify-between border-b border-white/7 bg-[#222228] px-4">
        <div class="flex items-center gap-2">
          <span class="size-[0.68rem] rounded-full bg-[#ff5f57]"></span>
          <span class="size-[0.68rem] rounded-full bg-[#febc2e]"></span>
          <span class="size-[0.68rem] rounded-full bg-[#28c840]"></span>
        </div>

        <div class="flex items-center gap-2 text-[12px] font-medium text-zinc-300">
          <span class="opacity-80">*</span>
          <span>Claude Code</span>
        </div>

        <div class="w-[3.25rem]"></div>
      </div>

      <div class="bg-[#222228] p-4 font-mono text-[13px] leading-6 text-zinc-100">
        <div class="rounded-lg border border-[#d97757]/70 px-3 py-2.5">
          <div class="flex items-center gap-2 text-[#ef8a66]">
            <ClaudeCode.Root class="size-4.5" />
            <span>Claude Code</span>
            <span class="text-zinc-400">v2.1.87</span>
          </div>
        </div>

        <div class="mt-4 space-y-2 text-[15px] leading-7">
          <div class="text-zinc-300">
            <span class="text-zinc-500">›</span>
            <span class="ml-2">/mcp connect orvo</span>
          </div>
          <div class="text-zinc-300">
            <span class="text-zinc-500">›</span>
            <span class="ml-2">show me what is actively failing in checkout</span>
          </div>
        </div>

        <div class="mt-5 text-[#d7d4cd]">
          <div class="mb-2 flex items-start gap-3">
            <span class="mt-[0.55rem] size-1.5 shrink-0 rounded-full bg-zinc-200"></span>
            <p>I'll check Orvo for the signals that are actively failing in checkout.</p>
          </div>

          <div class="space-y-1.5 border-l border-white/10 pl-5">
            <div class="flex items-center gap-2 text-zinc-400">
              <span class="text-zinc-500">└</span>
              <span>orvo.query({`signal: "checkout"`})…</span>
            </div>
            <p class="text-[#d38a73]">
              · Processing… <span class="text-zinc-500">(8s · esc to interrupt)</span>
            </p>
          </div>

          <div class="mt-4 space-y-1">
            {#each terminalOutput as line, index (`${line}-${index}`)}
              <p class={line === '' ? 'h-2' : ''}>{line}</p>
            {/each}
          </div>
        </div>

        <div class="mt-5 rounded-md border border-white/18 bg-[#1b1b20] px-3 py-2.5">
          <div class="flex items-center gap-2 text-zinc-200">
            <span>&gt;</span>
            <span class="inline-block h-5 w-2.5 bg-white"></span>
          </div>
        </div>

        <div class="mt-3 flex items-center justify-between gap-3 text-[11px] text-zinc-500">
          <span>! for bash mode · / for commands · tab to undo</span>
          <span>↵ for newline</span>
        </div>
      </div>
    </div>
  </div>
</Card.Root>
