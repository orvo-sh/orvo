<script lang="ts">
  import { Badge } from '@repo/components/ui/badge';
  import { Button } from '@repo/components/ui/button';
  import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@repo/components/ui/card';
  import { productFeatures } from '$lib/product-features';

  let { data } = $props<{
    data: {
      feature: (typeof productFeatures)[number];
    };
  }>();

  const { feature } = data;
</script>

<section class="from-muted/70 to-background border-b bg-linear-to-b pt-32 pb-16">
  <div class="mx-auto flex max-w-6xl flex-col gap-8 px-6 lg:px-8">
    <div class="max-w-3xl space-y-4">
      <Badge variant="secondary">{feature.eyebrow}</Badge>
      <h1 class="text-4xl font-medium text-balance lg:text-5xl">{feature.title}</h1>
      <p class="text-muted-foreground text-lg leading-relaxed text-balance">
        {feature.description}
      </p>
      <div class="flex flex-col items-center gap-3 *:w-full sm:flex-row sm:*:w-fit">
        <Button href="https://app.orvo.sh/sign-up">Start free trial</Button>
        <Button href="/product" variant="outline">View all product areas</Button>
      </div>
    </div>
  </div>
</section>

<section class="py-16">
  <div class="mx-auto grid max-w-6xl gap-6 px-6 lg:grid-cols-[1.2fr_0.8fr] lg:px-8">
    <Card class="rounded-2xl">
      <CardHeader>
        <CardTitle>What you get</CardTitle>
        <CardDescription>
          Core features for {feature.title.toLowerCase()} inside Orvo.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <ul class="space-y-3 text-sm leading-relaxed text-slate-700">
          {#each feature.features as item}
            <li>{item}</li>
          {/each}
        </ul>
      </CardContent>
    </Card>

    <Card class="rounded-2xl">
      <CardHeader>
        <CardTitle>Common use cases</CardTitle>
        <CardDescription>Where teams usually start with this feature.</CardDescription>
      </CardHeader>
      <CardContent>
        <ul class="space-y-3 text-sm leading-relaxed text-slate-700">
          {#each feature.useCases as useCase}
            <li>{useCase}</li>
          {/each}
        </ul>
      </CardContent>
    </Card>
  </div>
</section>
