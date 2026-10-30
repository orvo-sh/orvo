<script lang="ts">
  import { SlackIcon } from '@repo/components/icons/slack';
  import { Badge } from '@repo/components/ui/badge';
  import * as Card from '@repo/components/ui/card';
  import { IconMail, IconWebhook } from '@tabler/icons-svelte';
</script>

<Card.Root class="gap-0 p-5 shadow">
  <h2 class="text-secondary-foreground text-lg font-medium">Notifications</h2>
  <p class="text-muted-foreground mt-1.5 text-base leading-relaxed">
    Send alert and heartbeat notifications to
    <Badge
      href="/docs/integrations/slack"
      variant="outline"
      class="bg-muted/40 hover:bg-muted gap-1.5 rounded-md px-2 py-0.5 align-middle text-sm font-normal"
      ><SlackIcon class="size-3.5" alt="" />Slack</Badge
    >,
    <Badge
      href="/docs/integrations/email"
      variant="outline"
      class="bg-muted/40 hover:bg-muted gap-1.5 rounded-md px-2 py-0.5 align-middle text-sm font-normal"
      ><IconMail aria-hidden="true" />Email</Badge
    >, or
    <Badge
      href="/docs/integrations/webhooks"
      variant="outline"
      class="bg-muted/40 hover:bg-muted gap-1.5 rounded-md px-2 py-0.5 align-middle text-sm font-normal"
      ><IconWebhook aria-hidden="true" />Webhooks</Badge
    >
    so your team can respond where they work.
  </p>
</Card.Root>
