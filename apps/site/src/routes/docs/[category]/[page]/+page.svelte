<script lang="ts">
  import { resolve } from '$app/paths';
  import { page } from '$app/state';
  import { Button } from '@repo/components/ui/button';
  import * as Card from '@repo/components/ui/card';
  import { Label } from '@repo/components/ui/label';

  import type { PageData } from './$types';

  let { data }: { data: PageData } = $props();

  let currentHeadingId = $state('');
  let observer: IntersectionObserver | null = null;

  const setupObserver = () => {
    observer?.disconnect();
    currentHeadingId = '';

    if (typeof IntersectionObserver === 'undefined') {
      observer = null;
      return;
    }

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
    void data.content;
    setupObserver();

    return () => {
      observer?.disconnect();
      observer = null;
    };
  });
</script>

<div class="mx-auto flex w-full max-w-6xl flex-col gap-10 px-4 pt-24 pb-16 lg:flex-row lg:px-8">
  <aside class="top-20 w-full shrink-0 lg:sticky lg:w-60">
    {#each data.groups as group (group.label)}
      <div class="pb-6">
        <Label class="text-muted-foreground text-xs font-semibold tracking-[0.16em] uppercase">
          {group.label}
        </Label>
        <div class="mt-3 grid gap-0">
          {#each group.docs as item (item.href)}
            <a
              href={resolve(item.href)}
              class:text-primary={item.href === page.url.pathname}
              class="text-muted-foreground hover:text-foreground rounded-md px-2 py-1 text-sm transition-colors"
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
          {data.category}
        </p>
        <h1 class="text-4xl font-medium text-balance">{data.title}</h1>
        {#if data.description}
          <p class="text-muted-foreground max-w-2xl text-lg leading-relaxed text-balance">
            {data.description}
          </p>
        {/if}
        <!-- {#if data.doc.description}
          <p class="text-muted-foreground text-lg leading-relaxed text-balance">
            {data.doc.description}
          </p>
        {/if} -->
      </div>

      <article
        class="docs-content text-foreground/90 [&_:not(pre)>code]:bg-muted/50 [&_a]:text-primary space-y-6 leading-7 [&_:not(pre)>code]:rounded-md [&_:not(pre)>code]:border [&_:not(pre)>code]:px-1.5 [&_:not(pre)>code]:py-0.5 [&_:not(pre)>code]:font-mono [&_:not(pre)>code]:text-sm [&_a]:underline-offset-4 [&_a:hover]:underline [&_blockquote]:border-l-2 [&_blockquote]:pl-4 [&_h2]:mt-10 [&_h2]:text-2xl [&_h2]:font-medium [&_h3]:mt-8 [&_h3]:text-xl [&_h3]:font-medium [&_img]:rounded-2xl [&_img]:border [&_img]:shadow-sm [&_img+em]:mt-2 [&_img+em]:block [&_img+em]:text-sm [&_img+em]:text-muted-foreground [&_li]:ml-5 [&_li]:list-disc [&_ol]:space-y-3 [&_p]:text-base [&_p]:leading-7 [&_pre]:overflow-x-auto [&_pre]:rounded-xl [&_pre]:border [&_pre]:bg-slate-950 [&_pre]:p-4 [&_pre]:text-sm [&_pre]:text-slate-100 [&_ul]:space-y-3"
      >
        <!-- eslint-disable-next-line svelte/no-at-html-tags -->
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
                  <Button href={resolve(data.previous.href)} variant="outline"
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
                  <Button href={resolve(data.next.href)}>Read {data.next.title}</Button>
                </Card.Content>
              </Card.Root>
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
      {#each data.toc as item (item.slug)}
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
