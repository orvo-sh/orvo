<script lang="ts">
  import { Button, buttonVariants } from "@repo/components/ui/button";
  import * as Card from "@repo/components/ui/card";
  import { Input } from "@repo/components/ui/input";
  import { Label } from "@repo/components/ui/label";
  import { toast } from "@repo/components/ui/sonner";
  import { IconChevronRight, IconCopy } from "@tabler/icons-svelte";

  import { OrvoLogo } from "@repo/components/icons/orvo-logo";
  import { redact } from "@repo/utils";
  import OnboardingBannerInstallDialog from "./onboarding-banner-install-dialog.svelte";

  const {
    ingestionKey,
  }: {
    ingestionKey: string;
  } = $props();
</script>

<Card.Root class="bg-linear-200 from-5% from-primary/7 via-card to-card relative">
  <Card.Header>
    <OrvoLogo class="size-60 absolute -right-16 -top-24 opacity-30" />
    <Card.Title>
      Start sending telemetry
    </Card.Title>
    <Card.Description class="max-w-2xl">
      Install the OpenTelemetry SDK on your system to start collecting
      logs, traces, and metrics. It takes about 5 minutes to complete. This banner will disappear once we receive your first signal.
    </Card.Description>
  </Card.Header>
  <Card.Content class="grid gap-3 sm:grid-cols-2 max-w-4xl">
      
        <div>
          <Label class="mb-1 ml-1">Ingest endpoint</Label>
          <div class="flex">
            <Input value="https://ingest.orvo.sh" readonly class="border-r-0 bg-card rounded-r-none" />
            <Button
              variant="outline"
              size="sm"
              class="h-8 px-2 rounded-l-none"
              onclick={() => window.navigator?.clipboard.writeText("https://ingest.orvo.sh").then(() => {
                toast.success("Copied ingest url to clipboard.");
              })              
             }
            >
              <IconCopy class="size-3.5" />
            </Button>
          </div>
        </div>

        <div>
          <Label class="mb-1 ml-1">Ingestion key</Label>
          <div class="flex">
            <Input
              value={redact(ingestionKey, "*", 6)}
              readonly
              class="border-r-0 rounded-r-none bg-card"
            />
            <Button
              variant="outline"
              size="sm"
              class="h-8 px-2 rounded-l-none"
              onclick={() => window.navigator?.clipboard.writeText(ingestionKey).then(() => {
                toast.success("Copied ingestion key to clipboard.");
              })}              
            >
              <IconCopy class="size-3.5" />
            </Button>
          </div>
        </div>
      
    </Card.Content>
    <Card.Footer class="p-3 border-t-0 bg-transparent gap-2">
      <OnboardingBannerInstallDialog {ingestionKey} class={buttonVariants()}>
        Show me how 
        <span class="rounded-full bg-primary-foreground/20 ml-1">
          <IconChevronRight />
        </span>
      </OnboardingBannerInstallDialog>
      <Button variant="outline" onclick={() => location.reload()}>
        Refresh
      </Button>
    </Card.Footer>
</Card.Root>
