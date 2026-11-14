<script lang="ts">
  import { OrvoLogo } from '@repo/components/icons/orvo-logo';
  import { SlackIcon } from '@repo/components/icons/slack';
  import DecieAvatar from '$lib/assets/decie-avatar.jpg';
  import { Avatar, AvatarFallback, AvatarImage } from '@repo/components/ui/avatar';
  import { Badge } from '@repo/components/ui/badge';
  import { IconHash } from '@tabler/icons-svelte';
</script>

<div>
  <div class="flex items-center justify-between gap-3 px-0 py-4">
    <span class="flex items-center gap-2 text-sm font-medium">
      <IconHash class="text-muted-foreground size-4" aria-hidden="true" />
      engineering
    </span>
    <SlackIcon class="size-5" alt="Slack" />
  </div>
  <div class="space-y-5 pt-4">
    <div class="flex gap-3">
      <Avatar class="size-8 shrink-0 rounded-lg">
        <AvatarImage src={DecieAvatar} alt="decie femayi" class="rounded-lg object-cover" />
        <AvatarFallback class="bg-muted rounded-lg text-xs">DF</AvatarFallback>
      </Avatar>
      <div class="min-w-0 space-y-1 text-sm leading-relaxed">
        <p class="font-medium">
          Decie <span class="text-muted-foreground ml-1 text-xs font-normal">10:42</span>
        </p>
        <p>
          <span class="text-primary bg-primary/10 rounded px-1">@Orvo</span> Is it affecting catalog or
          inventory too?
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
          The failures converge on <strong class="font-medium">payments</strong>. Catalog and
          inventory show no matching error spike. Start with the payments rollback.
        </p>
        <div class="border-primary/30 space-y-2 border-l-2 pl-3">
          <p class="text-muted-foreground text-xs">Impact checked</p>
          <div class="flex flex-wrap gap-2">
            <Badge variant="outline">Payments → postgres</Badge>
            <Badge variant="outline">3 services checked</Badge>
          </div>
        </div>
      </div>
    </div>
  </div>
</div>
