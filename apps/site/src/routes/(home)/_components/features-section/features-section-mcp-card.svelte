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
</script>

<Card.Root
  class="bg-card/90 border-foreground/10 gap-0 overflow-hidden p-0 shadow-none md:col-span-2 xl:col-span-8"
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

  <div class="px-5 pt-4">
    <div
      class="h-96 overflow-hidden rounded-t-lg border border-b-0 border-zinc-700/80 bg-[#222228]"
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
        <div class="rounded-md border border-[#d97757]/70 px-3 py-2">
          <div class="flex items-center gap-2 text-[#ef8a66]">
            <ClaudeCode.Root class="size-4.5" />
            <span>Claude Code</span>
            <span class="text-zinc-400">v2.1.87</span>
          </div>
        </div>

        <div class="mt-3 space-y-1.5 text-[15px] leading-7">
          <div class="text-zinc-300">
            <span class="text-zinc-500">›</span>
            <span class="ml-2">/mcp connect orvo</span>
          </div>
          <div class="text-zinc-300">
            <span class="text-zinc-500">›</span>
            <span class="ml-2">show me what is actively failing in checkout</span>
          </div>
        </div>

        <div class="mt-3 text-[#d7d4cd]">
          <div class="space-y-1.5 border-l border-white/10 pl-4">
            <div class="flex items-center gap-2 text-zinc-400">
              <span class="text-zinc-500">└</span>
              <span>orvo.query({`signal: "checkout"`})…</span>
            </div>
            <p class="text-[#d38a73]">
              · Processing… <span class="text-zinc-500">(8s · esc to interrupt)</span>
            </p>
          </div>

          <div class="mt-3 space-y-2 text-zinc-300">
            <p class="flex items-center gap-2">
              <span class="text-emerald-400">✓</span>
              Orvo query completed
            </p>

            <div class="space-y-2 leading-6">
              <p>
                Checkout is currently degraded across
                <span class="text-zinc-100">api-checkout</span>.
              </p>
              <div class="space-y-1 text-zinc-400">
                <p>
                  <span class="mr-2 text-zinc-600">•</span>Two alerts are firing for error rate and
                  p95 latency.
                </p>
                <p>
                  <span class="mr-2 text-zinc-600">•</span>The incident
                  <span class="text-zinc-200">`api-checkout latency spike`</span> has been open for 7
                  minutes.
                </p>
                <p>
                  <span class="mr-2 text-zinc-600">•</span>Slow traces converge on
                  <span class="text-zinc-200">`stripe.payment_intents.create`</span>.
                </p>
              </div>
            </div>

            <div class="space-y-2 pt-1 text-zinc-300">
              <p>
                All three signals started after deploy
                <span class="text-zinc-100">`8f3c7de`</span>. The affected request is
                <span class="text-zinc-100">`POST /api/checkout/confirm`</span>.
              </p>
              <p class="text-zinc-400">
                Want me to open the incident or compare traces from before and after the deploy?
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</Card.Root>
