<script lang="ts">
  import { ClaudeIcon } from '@repo/components/icons/claude';
  import { CodexIcon } from '@repo/components/icons/codex';
  import { CursorIcon } from '@repo/components/icons/cursor';
  import { McpIcon } from '@repo/components/icons/mcp';
  import { Card, CardContent } from '@repo/components/ui/card';
  import { IconArrowRight, IconCheck, IconSearch } from '@tabler/icons-svelte';
  import ScoutSlackPreview from './scout-slack-preview.svelte';
</script>

<div class="mx-auto w-full max-w-6xl px-3 md:px-6">
  <div class="grid gap-6 md:grid-cols-2">
    <Card class="bg-card min-w-0 gap-0 p-0 shadow-none">
      <div class="scout-detail-preview h-80 overflow-hidden px-5 pt-3">
        <div class="w-full">
          <ScoutSlackPreview />
        </div>
      </div>
      <CardContent class="p-5 pt-3">
        <h3 class="text-secondary-foreground text-lg font-medium">Bring Scout into Slack</h3>
        <p class="text-muted-foreground mt-1.5 text-base leading-relaxed">
          Ask a follow-up, check the impact, and investigate together in the thread your team is
          already in.
          <a
            href="/docs/integrations/slack"
            class="text-primary bg-primary/5 hover:bg-primary/10 inline-flex items-center gap-1 rounded-md px-2 text-base underline-offset-4 transition-colors"
          >
            Explore Slack <IconArrowRight class="size-4" aria-hidden="true" />
          </a>
        </p>
      </CardContent>
    </Card>

    <Card class="bg-card min-w-0 gap-0 p-0 shadow-none">
      <div class="scout-detail-preview h-80 overflow-hidden px-5 pt-3">
        <div class="w-full">
          <div class="flex items-center justify-between gap-3 py-4">
            <span class="flex items-center gap-2 text-sm font-medium">
              <McpIcon class="size-4" alt="" />
              Orvo MCP
            </span>
            <ul class="flex items-center gap-3" aria-label="Compatible agents">
              <li title="Claude"><ClaudeIcon class="size-5" /></li>
              <li title="Codex"><CodexIcon class="size-5 dark:invert" /></li>
              <li title="Cursor"><CursorIcon class="size-5" /></li>
            </ul>
          </div>
          <div class="space-y-5 pt-4">
            <div class="bg-muted rounded-xl rounded-br-sm px-3 py-2.5 text-sm leading-relaxed">
              Find what’s behind the checkout errors.
            </div>
            <div class="space-y-4">
              <div class="flex items-start gap-2.5 text-sm">
                <IconSearch
                  class="text-muted-foreground mt-0.5 size-4 shrink-0"
                  aria-hidden="true"
                />
                <div class="min-w-0 flex-1">
                  <p class="font-mono text-xs">search_traces</p>
                  <p class="text-muted-foreground mt-1 text-xs">Follow failed checkout requests</p>
                </div>
                <IconCheck class="text-muted-foreground size-4 shrink-0" aria-hidden="true" />
              </div>
              <div class="flex items-start gap-2.5 text-sm">
                <IconSearch
                  class="text-muted-foreground mt-0.5 size-4 shrink-0"
                  aria-hidden="true"
                />
                <div class="min-w-0 flex-1">
                  <p class="font-mono text-xs">search_logs</p>
                  <p class="text-muted-foreground mt-1 text-xs">Correlate errors in payments</p>
                </div>
                <IconCheck class="text-muted-foreground size-4 shrink-0" aria-hidden="true" />
              </div>
            </div>
            <p class="border-t pt-4 text-sm leading-relaxed">
              The failed requests share a timeout in <strong class="font-medium">payments</strong>.
            </p>
          </div>
        </div>
      </div>
      <CardContent class="p-5 pt-3">
        <h3 class="text-secondary-foreground text-lg font-medium">Bring your own agent</h3>
        <p class="text-muted-foreground mt-1.5 text-base leading-relaxed">
          Connect your preferred MCP client to Orvo. Search logs, follow traces, and query metrics
          with scoped, read-only access.
          <a
            href="/docs/integrations/mcp"
            class="text-primary bg-primary/5 hover:bg-primary/10 inline-flex items-center gap-1 rounded-md px-2 text-base underline-offset-4 transition-colors"
          >
            Explore MCP <IconArrowRight class="size-4" aria-hidden="true" />
          </a>
        </p>
      </CardContent>
    </Card>
  </div>
</div>

<style>
  .scout-detail-preview {
    mask-image: linear-gradient(to bottom, black 45%, transparent 100%);
  }
</style>
