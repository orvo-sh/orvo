<script lang="ts">
  import { Button } from '@repo/components/ui/button';
  import { IconArrowUpRight, IconTerminal2 } from '@tabler/icons-svelte';

  const languages = [
    { label: 'Node.js', slug: 'nodejs' },
    { label: 'Python', slug: 'python' },
    { label: 'Go', slug: 'go' },
    { label: 'Java', slug: 'java' },
    { label: '.NET', slug: 'dotnet' },
    { label: 'Rust', slug: 'rust' }
  ];
  const configuration = `# For an app already instrumented with OpenTelemetry
OTEL_SERVICE_NAME=checkout-api
OTEL_RESOURCE_ATTRIBUTES=deployment.environment=production
OTEL_EXPORTER_OTLP_PROTOCOL=http/protobuf
OTEL_EXPORTER_OTLP_ENDPOINT=https://ingest.orvo.sh
OTEL_EXPORTER_OTLP_HEADERS="Authorization=Bearer YOUR_INGESTION_KEY"`;
</script>

<section class="bg-background border-b py-16 md:py-24">
  <div
    class="mx-auto grid max-w-6xl gap-10 px-3 md:px-6 lg:grid-cols-[0.8fr_1.2fr] lg:items-center"
  >
    <div>
      <p class="text-primary text-sm font-medium">Bring your first service</p>
      <h2 class="mt-3 text-3xl font-medium text-balance lg:text-4xl">
        Keep your instrumentation.<br />Change your destination.
      </h2>
      <p class="text-muted-foreground mt-4 leading-relaxed">
        Already using OpenTelemetry? Configure your OTLP exporter for Orvo. Starting fresh? Follow a
        language guide and instrument one service first.
      </p>
      <div class="mt-5 flex flex-wrap gap-2">
        {#each languages as language (language.slug)}
          <Button href={`/docs/opentelemetry/${language.slug}`} variant="outline" size="sm"
            >{language.label}</Button
          >
        {/each}
      </div>
      <Button
        href="/docs/getting-started/send-your-first-telemetry"
        variant="link"
        class="mt-4 px-0"
        >Send your first telemetry<IconArrowUpRight data-slot="button-icon" /></Button
      >
    </div>
    <div class="bg-muted/30 min-w-0 overflow-hidden rounded-xl border">
      <div class="text-muted-foreground flex items-center gap-2 border-b px-5 py-3 text-sm">
        <IconTerminal2 class="size-4" />OTLP / HTTP configuration
      </div>
      <pre class="overflow-x-auto p-5 text-xs leading-7 sm:text-sm"><code>{configuration}</code
        ></pre>
      <div class="bg-background grid grid-cols-3 gap-3 border-t p-5 text-sm">
        <div>
          <span class="text-primary font-mono text-xs">01</span>
          <p class="mt-2">Create an app</p>
        </div>
        <div>
          <span class="text-primary font-mono text-xs">02</span>
          <p class="mt-2">Add your ingest key</p>
        </div>
        <div>
          <span class="text-primary font-mono text-xs">03</span>
          <p class="mt-2">Send a test request</p>
        </div>
      </div>
    </div>
  </div>
</section>
