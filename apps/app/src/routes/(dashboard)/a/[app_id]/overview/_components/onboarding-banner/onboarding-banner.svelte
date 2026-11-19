<script lang="ts">
  import AgentSetupButton from "@repo/components/ui/agent-setup-button";
  import { Button } from "@repo/components/ui/button";
  import * as Card from "@repo/components/ui/card";
  import { Input } from "@repo/components/ui/input";
  import { Label } from "@repo/components/ui/label";
  import { toast } from "@repo/components/ui/sonner";
  import { IconCopy } from "@tabler/icons-svelte";

  import { redact } from "@repo/utils";
  import { trackAgentSetup } from "./agent-setup.remote";

  const {
    ingestionKey,
  }: {
    ingestionKey: string;
  } = $props();
  const ingestEndpoint = "https://ingest.orvo.sh";
  const setupPrompt = `Set up Orvo observability in this project. Read https://orvo.sh/SKILL.md and follow its instructions.

Use these OpenTelemetry settings for Orvo Cloud:
OTEL_EXPORTER_OTLP_PROTOCOL=http/protobuf
OTEL_EXPORTER_OTLP_ENDPOINT=${ingestEndpoint}
OTEL_EXPORTER_OTLP_HEADERS="Authorization=Bearer YOUR_INGESTION_KEY"

If an Orvo ingestion key is not already configured, prepare the setup with the placeholder. Tell me to click Copy ingestion key on the Orvo Overview card or get an available key from Settings → Ingestion keys in the Orvo dashboard. Tell me where to set it in this project's local environment or deployment secrets. Do not ask me to paste the key into this chat. Once a valid key is configured, send a test signal and tell me how to verify it in Orvo.`;

  const trackSetup = (event: "clicked" | "copied") => {
    void trackAgentSetup(event).catch(() => {});
  };
</script>

<Card.Root>
  <Card.Header>
    <Card.Title>Start sending telemetry</Card.Title>
    <Card.Description class="max-w-2xl">
      Install the OpenTelemetry SDK on your system to start collecting logs,
      traces, and metrics. It takes about 5 minutes to complete. This banner
      will disappear once we receive your first signal.
    </Card.Description>
  </Card.Header>
  <Card.Content class="grid max-w-4xl gap-3 sm:grid-cols-2">
    <div>
      <Label class="mb-1 ml-1">Ingest endpoint</Label>
      <div class="flex">
        <Input
          value={ingestEndpoint}
          readonly
          class="rounded-r-none border-r-0 bg-card"
        />
        <Button
          variant="outline"
          size="sm"
          class="h-8 rounded-l-none px-2"
          onclick={() =>
            window.navigator?.clipboard.writeText(ingestEndpoint).then(() => {
              toast.success("Copied ingest url to clipboard.");
            })}
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
          class="rounded-r-none border-r-0 bg-card"
        />
        <Button
          variant="outline"
          size="sm"
          class="h-8 rounded-l-none px-2"
          aria-label="Copy ingestion key"
          disabled={!ingestionKey}
          onclick={() =>
            window.navigator?.clipboard.writeText(ingestionKey).then(() => {
              toast.success("Copied ingestion key to clipboard.");
            })}
        >
          <IconCopy class="size-3.5" />
        </Button>
      </div>
    </div>
  </Card.Content>
  <Card.Footer class="gap-2 border-t-0 bg-transparent p-3">
    <AgentSetupButton
      prompt={setupPrompt}
      label="Set up with agent"
      variant="default"
      size="default"
      onClick={() => trackSetup("clicked")}
      onCopied={() => {
        trackSetup("copied");
        toast.success("Paste the prompt into your agent", {
          description:
            "If you need a key, use Copy ingestion key on this card or get one from Settings → Ingestion keys.",
        });
      }}
    />
    <Button variant="outline" onclick={() => location.reload()}>Refresh</Button>
  </Card.Footer>
</Card.Root>
