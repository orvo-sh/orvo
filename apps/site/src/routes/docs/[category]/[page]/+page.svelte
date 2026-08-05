<script lang="ts">
  import { page } from '$app/state';
  import { Button } from '@repo/components/ui/button';
  import * as Card from '@repo/components/ui/card';
  import { Label } from '@repo/components/ui/label';

  let { data } = $props();
</script>

<div
  class="mx-auto flex w-full max-w-6xl flex-col gap-6 px-3 pt-24 pb-16 md:flex-row md:gap-3 md:px-6"
>
  <aside
    class="border-border w-60 shrink-0 not-md:hidden md:sticky md:top-24 md:max-h-[calc(100svh-7rem)] md:self-start md:overflow-y-auto"
  >
    {#each data.groups as group (group.label)}
      <div class="pb-6">
        <Label class="text-muted-foreground/80 text-sm font-normal tracking-wide uppercase">
          {group.label}
        </Label>
        <div class="mt-2 grid gap-0">
          {#each group.docs as item (item.href)}
            <a
              href={item.href}
              class:text-primary!={item.href === page.url.pathname}
              class="text-muted-foreground hover:text-foreground rounded-md py-1.5 text-sm transition-colors"
            >
              {item.title}
            </a>
          {/each}
        </div>
      </div>
    {/each}
  </aside>

  <main class="min-w-0 flex-1">
    <div>
      <article class="docs-content prose max-w-4xl px-3 [&_h1,&_h2,&_h3,&_h4,&_h5]:font-medium">
        {@html data.content}
      </article>

      {#if data.previous || data.next}
        <section class="mt-16 border-t pt-10">
          <div class="mb-5 space-y-2">
            <p class="text-muted-foreground text-sm">Keep reading</p>
            <h2 class="text-2xl font-medium">Adjacent docs</h2>
          </div>

          <div class="grid gap-4 md:grid-cols-2">
            {#if data.previous}
              <Card.Root class="rounded-2xl">
                <Card.Header class="space-y-3">
                  <p class="text-muted-foreground text-sm">Previous doc</p>
                  <div class="space-y-2">
                    <Card.Title>{data.previous.title}</Card.Title>
                  </div>
                </Card.Header>
                <Card.Content>
                  <Button href={data.previous.href} variant="outline"
                    >Read {data.previous.title}</Button
                  >
                </Card.Content>
              </Card.Root>
            {/if}

            {#if data.next}
              <Card.Root class="rounded-2xl">
                <Card.Header class="space-y-3">
                  <p class="text-muted-foreground text-sm">Next doc</p>
                  <div class="space-y-2">
                    <Card.Title>{data.next.title}</Card.Title>
                  </div>
                </Card.Header>
                <Card.Content>
                  <Button href={data.next.href}>Read {data.next.title}</Button>
                </Card.Content>
              </Card.Root>
            {/if}
          </div>
        </section>
      {/if}
    </div>
  </main>
</div>

<style>
  :global(.docs-content .callout) {
    margin-bottom: 1.5rem;
    display: flex;
    gap: 0.75rem;
    border: 1px solid color-mix(in oklab, var(--color-border) 100%, transparent);
    border-radius: 0.75rem;
    padding: 0.75rem 1rem;
  }

  :global(.docs-content .callout-content p) {
    margin: 0;
  }

  :global(.docs-content .callout-content code) {
    border: 0;
    background: transparent;
    padding: 0;
    box-shadow: none;
  }

  :global(.docs-content .callout-info) {
    border-color: color-mix(in oklab, var(--color-blue-500) 20%, transparent);
    background: color-mix(in oklab, var(--color-blue-500) 8%, white);
    color: color-mix(in oklab, var(--color-blue-950) 85%, transparent);
  }

  :global(.docs-content .callout-icon) {
    margin-top: 0.125rem;
    display: inline-flex;
    width: 1.25rem;
    height: 1.25rem;
    flex-shrink: 0;
    color: color-mix(in oklab, var(--color-blue-700) 80%, transparent);
  }

  :global(.docs-content .callout-icon svg) {
    width: 1.25rem;
    height: 1.25rem;
  }
</style>
