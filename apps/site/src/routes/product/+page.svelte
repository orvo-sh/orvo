<script lang="ts">
  import { Button } from '@repo/components/ui/button';
  import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@repo/components/ui/card';
  import { productFeatures } from '$lib/product-features';
</script>

<section class="from-muted/70 to-background border-b bg-linear-to-b pt-32 pb-16">
  <div class="mx-auto flex max-w-6xl flex-col gap-6 px-6 lg:px-8">
    <div class="max-w-3xl space-y-4">
      <div class="text-sm font-medium tracking-[0.16em] text-slate-500 uppercase">Product</div>
      <h1 class="text-4xl font-medium text-balance lg:text-5xl">
        One product surface across every operational signal.
      </h1>
      <p class="text-muted-foreground text-lg leading-relaxed text-balance">
        Orvo brings together tracing, logs, metrics, alerts, and heartbeats so teams can
        move from detection to explanation without switching tools.
      </p>
    </div>
  </div>
</section>

<section class="py-16">
  <div class="mx-auto flex max-w-6xl flex-col gap-8 px-6 lg:px-8">
    <div class="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
      {#each productFeatures as feature}
        <a href={feature.href} class="block">
          <Card class="h-full rounded-2xl transition-transform hover:-translate-y-0.5">
            <CardHeader class="space-y-3">
              <div class="text-xs font-medium tracking-[0.16em] text-slate-500 uppercase">
                {feature.eyebrow}
              </div>
              <div class="space-y-2">
                <CardTitle class="text-xl">{feature.title}</CardTitle>
                <CardDescription class="text-sm leading-relaxed">
                  {feature.summary}
                </CardDescription>
              </div>
            </CardHeader>
            <CardContent>
              <ul class="space-y-2 text-sm leading-relaxed text-slate-600">
                {#each feature.features.slice(0, 2) as item}
                  <li>{item}</li>
                {/each}
              </ul>
            </CardContent>
          </Card>
        </a>
      {/each}
    </div>

    <div class="flex flex-col items-start gap-3 rounded-2xl border bg-card p-6 sm:flex-row sm:items-center sm:justify-between">
      <div class="space-y-1">
        <h2 class="text-xl font-medium">Ready to try Orvo?</h2>
        <p class="text-muted-foreground text-sm leading-relaxed">
          Start with one signal or bring your whole OpenTelemetry pipeline.
        </p>
      </div>
      <Button href="https://app.orvo.sh/sign-up">Start free trial</Button>
    </div>
  </div>
</section>
