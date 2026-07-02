<script lang="ts">
  import { Button } from '@repo/components/ui/button';
  import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@repo/components/ui/card';
  import { Label } from '@repo/components/ui/label';
  import type { PageData } from './$types';
  import { onDestroy } from 'svelte';

  let { data }: { data: PageData } = $props();

  let currentHeadingId = $state('');
  let observer = $state<IntersectionObserver | null>(null);

  const setupObserver = () => {
    observer?.disconnect();

    observer = new IntersectionObserver(
      (entries) => {
        const visible = entries.find((entry) => entry.isIntersecting);

        if (visible) {
          currentHeadingId = visible.target.id;
        }
      },
      { threshold: 0.5 }
    );

    document.querySelectorAll('[data-track]').forEach((element) => observer?.observe(element));
  };

  $effect(() => {
    setupObserver();
  });

  onDestroy(() => {
    observer?.disconnect();
  });
</script>

<div class="mx-auto flex w-full max-w-6xl flex-col gap-10 px-4 pb-16 pt-24 lg:flex-row lg:px-8">
  <aside class="top-20 w-full shrink-0 lg:sticky lg:w-60">
    {#each data.groups as group}
      <div class="pb-6">
        <Label class="text-muted-foreground text-xs font-semibold tracking-[0.16em] uppercase">
          {group.label}
        </Label>
        <div class="mt-3 grid gap-1">
          {#each group.docs as item}
            <a
              href={item.href}
              class:text-primary={item.href === data.doc.href}
              class="text-muted-foreground hover:text-foreground rounded-md px-2 py-1.5 text-sm transition-colors"
            >
              {item.title}
            </a>
          {/each}
        </div>
      </div>
    {/each}
  </aside>

  <main class="min-w-0 flex-1">
    <div class="max-w-3xl">
      <div class="mb-10 space-y-4">
        <p class="text-muted-foreground text-sm font-medium tracking-[0.16em] uppercase">
          {data.doc.category}
        </p>
        <h1 class="text-4xl font-medium text-balance">{data.doc.title}</h1>
        {#if data.doc.description}
          <p class="text-muted-foreground text-lg leading-relaxed text-balance">
            {data.doc.description}
          </p>
        {/if}
      </div>

      <article
        class="docs-content text-foreground/90 space-y-6 leading-7 [&_:not(pre)>code]:rounded-md [&_:not(pre)>code]:border [&_:not(pre)>code]:bg-muted/50 [&_:not(pre)>code]:px-1.5 [&_:not(pre)>code]:py-0.5 [&_:not(pre)>code]:font-mono [&_:not(pre)>code]:text-sm [&_a]:text-primary [&_a]:underline-offset-4 [&_a:hover]:underline [&_blockquote]:border-l-2 [&_blockquote]:pl-4 [&_h2]:mt-10 [&_h2]:text-2xl [&_h2]:font-medium [&_h3]:mt-8 [&_h3]:text-xl [&_h3]:font-medium [&_li]:ml-5 [&_li]:list-disc [&_ol]:space-y-3 [&_p]:text-base [&_p]:leading-7 [&_pre]:overflow-x-auto [&_pre]:rounded-xl [&_pre]:border [&_pre]:bg-slate-950 [&_pre]:p-4 [&_pre]:text-sm [&_pre]:text-slate-100 [&_ul]:space-y-3"
      >
        {@html data.content}
      </article>

      {#if data.previousDoc || data.nextDoc}
        <section class="mt-16 border-t pt-10">
          <div class="mb-5 space-y-2">
            <p class="text-muted-foreground text-sm">Keep reading</p>
            <h2 class="text-2xl font-medium">Adjacent docs</h2>
          </div>

          <div class="grid gap-4 md:grid-cols-2">
            {#if data.previousDoc}
              <Card class="rounded-2xl">
                <CardHeader class="space-y-3">
                  <p class="text-muted-foreground text-sm">Previous doc</p>
                  <div class="space-y-2">
                    <CardTitle>{data.previousDoc.title}</CardTitle>
                    <CardDescription>{data.previousDoc.description}</CardDescription>
                  </div>
                </CardHeader>
                <CardContent>
                  <Button href={data.previousDoc.href} variant="outline">Read {data.previousDoc.title}</Button>
                </CardContent>
              </Card>
            {/if}

            {#if data.nextDoc}
              <Card class="rounded-2xl">
                <CardHeader class="space-y-3">
                  <p class="text-muted-foreground text-sm">Next doc</p>
                  <div class="space-y-2">
                    <CardTitle>{data.nextDoc.title}</CardTitle>
                    <CardDescription>{data.nextDoc.description}</CardDescription>
                  </div>
                </CardHeader>
                <CardContent>
                  <Button href={data.nextDoc.href}>Read {data.nextDoc.title}</Button>
                </CardContent>
              </Card>
            {/if}
          </div>
        </section>
      {/if}
    </div>
  </main>

  <nav class="top-20 hidden w-56 shrink-0 lg:sticky lg:block">
    <Label class="text-muted-foreground text-xs font-semibold tracking-[0.16em] uppercase">
      On this page
    </Label>
    <ul class="mt-3 grid gap-1">
      {#each data.toc as item}
        <li>
          <a
            href={`#${item.slug}`}
            class:text-primary={currentHeadingId === item.slug}
            class="text-muted-foreground hover:text-foreground block rounded-md px-2 py-1.5 text-sm transition-colors"
          >
            {item.text}
          </a>
        </li>
      {/each}
    </ul>
  </nav>
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
