<script lang="ts">
  import { OrvoLogo } from '@repo/components/icons/orvo-logo';
  import { SlackIcon } from '@repo/components/icons/slack';
  import { Avatar, AvatarFallback } from '@repo/components/ui/avatar';
  import { Badge } from '@repo/components/ui/badge';
  import { Card, CardContent } from '@repo/components/ui/card';
  import { IconHash } from '@tabler/icons-svelte';
</script>

<Card class="aspect-9/16 gap-0 overflow-hidden rounded-2xl p-0 shadow-lg">
  <div class="flex items-center justify-between gap-3 border-b px-5 py-4">
    <span class="flex items-center gap-2 text-sm font-medium">
      <IconHash class="text-muted-foreground size-4" aria-hidden="true" />
      engineering
    </span>
    <SlackIcon class="size-5" alt="Slack" />
  </div>
  <CardContent class="space-y-6 p-5">
    <div class="flex gap-3">
      <Avatar class="size-8 shrink-0 rounded-lg">
        <AvatarFallback class="bg-muted rounded-lg text-xs">JD</AvatarFallback>
      </Avatar>
      <div class="min-w-0 space-y-1 text-sm leading-relaxed">
        <p class="font-medium">
          Jamie <span class="text-muted-foreground ml-1 text-xs font-normal">10:42</span>
        </p>
        <p>
          <span class="text-primary bg-primary/10 rounded px-1">@Orvo</span> Why are checkout requests
          failing?
        </p>
      </div>
    </div>

    <div class="flex gap-3">
      <div class="bg-muted flex size-8 shrink-0 items-center justify-center rounded-lg">
        <OrvoLogo class="size-6" alt="" />
      </div>
      <div class="min-w-0 space-y-3 text-sm leading-relaxed">
        <p class="flex flex-wrap items-center gap-2 font-medium">
          Orvo <Badge variant="secondary" class="px-1.5 py-0 text-[10px]">APP</Badge>
          <span class="text-muted-foreground text-xs font-normal">10:42</span>
        </p>
        <p>
          The failed requests share a timeout in the payments service. The related traces show
          checkout waiting on the same dependency.
        </p>
        <div class="border-primary/30 space-y-2 border-l-2 pl-3">
          <p class="text-muted-foreground text-xs">Evidence from this investigation</p>
          <div class="flex flex-wrap gap-2">
            <Badge variant="outline">Error logs</Badge>
            <Badge variant="outline">Failed traces</Badge>
            <Badge variant="outline">Service graph</Badge>
          </div>
        </div>
      </div>
    </div>

    <div class="flex gap-3">
      <Avatar class="size-8 shrink-0 rounded-lg">
        <AvatarFallback class="bg-muted rounded-lg text-xs">JD</AvatarFallback>
      </Avatar>
      <div class="min-w-0 space-y-1 text-sm leading-relaxed">
        <p class="font-medium">
          Jamie <span class="text-muted-foreground ml-1 text-xs font-normal">10:43</span>
        </p>
        <p>Is it affecting any other services?</p>
      </div>
    </div>
  </CardContent>
</Card>
