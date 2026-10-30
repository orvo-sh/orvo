<script lang="ts">
  import { PRO_PLAN } from '$lib/pricing';
  import { Button } from '@repo/components/ui/button';
  import { Badge } from '@repo/components/ui/badge';
  import { IconArrowUpRight, IconCheck, IconBrandGithub } from '@tabler/icons-svelte';
</script>

<section class="bg-muted/20 border-b py-16 md:py-24">
  <div class="mx-auto max-w-6xl px-3 md:px-6">
    <div class="max-w-2xl">
      <p class="text-primary text-sm font-medium">Open source. Your choice of home.</p>
      <h2 class="mt-3 text-3xl font-medium text-balance lg:text-4xl">
        Let us run it. Or explore the source.
      </h2>
      <p class="text-muted-foreground mt-4 text-lg leading-relaxed">
        Choose managed cloud to get started with Orvo, with the code available under AGPL-3.0.
      </p>
    </div>
    <div class="mt-10 grid gap-5 md:grid-cols-[1.2fr_1fr]">
      <div class="bg-background rounded-xl border p-6 sm:p-8">
        <div class="flex items-center justify-between gap-3">
          <h3 class="text-xl font-medium">Orvo Cloud</h3>
          <Badge variant="secondary">Managed for your team</Badge>
        </div>
        <p class="mt-6 text-4xl font-medium">
          ${PRO_PLAN.priceUsd}<span class="text-muted-foreground text-base font-normal">
            / month</span
          >
        </p>
        <p class="text-muted-foreground mt-2 text-sm">
          Start with a {PRO_PLAN.trialDays}-day free trial.
        </p>
        <div class="mt-6 grid gap-3 text-sm sm:grid-cols-2">
          {#each [`${PRO_PLAN.includedIngestGb} GB monthly ingest`, `${PRO_PLAN.retentionDays}-day retention`, 'Unlimited seats and queries', 'Scout and read-only MCP access'] as feature (feature)}
            <p class="flex items-center gap-2">
              <IconCheck class="text-primary size-4 shrink-0" />{feature}
            </p>
          {/each}
        </div>
        <p class="text-muted-foreground mt-5 text-sm">
          Additional ingest: ${PRO_PLAN.ingestOveragePerGb}/GB. Scout usage has a separate
          allowance.
        </p>
        <div class="mt-6 flex flex-wrap gap-3">
          <Button href="https://app.orvo.sh/sign-up"
            >Start free trial<IconArrowUpRight data-slot="button-icon" /></Button
          ><Button href="/pricing" variant="outline">See pricing and estimate usage</Button>
        </div>
      </div>
      <div class="bg-background flex flex-col rounded-xl border p-6 sm:p-8">
        <div class="flex items-center gap-2">
          <IconBrandGithub class="size-5" />
          <h3 class="text-xl font-medium">Built in the open</h3>
        </div>
        <p class="text-muted-foreground mt-5 leading-relaxed">
          Inspect the code, follow development, and contribute. OpenTelemetry keeps your
          instrumentation portable.
        </p>
        <div class="bg-muted/30 mt-6 rounded-lg border p-4">
          <p class="text-sm font-medium">Thinking about self-hosting?</p>
          <p class="text-muted-foreground mt-2 text-sm leading-relaxed">
            Deployment and operations documentation is still in progress. Review the repository for
            the current setup before choosing this route.
          </p>
        </div>
        <div class="mt-auto pt-6">
          <Button
            href="https://github.com/orvo-sh/orvo"
            target="_blank"
            rel="noreferrer"
            variant="outline"
            >Explore the repository<IconArrowUpRight data-slot="button-icon" /></Button
          >
        </div>
      </div>
    </div>
    <div
      class="mt-6 flex flex-col justify-between gap-3 rounded-xl border px-6 py-5 sm:flex-row sm:items-center"
    >
      <div>
        <p class="text-sm font-medium">Questions before sending production data?</p>
        <p class="text-muted-foreground mt-1 text-sm">
          Talk to us about hosting, data handling, and your team's requirements.
        </p>
      </div>
      <Button href="mailto:team@orvo.sh" variant="outline" class="shrink-0"
        >Contact the team<IconArrowUpRight data-slot="button-icon" /></Button
      >
    </div>
  </div>
</section>
