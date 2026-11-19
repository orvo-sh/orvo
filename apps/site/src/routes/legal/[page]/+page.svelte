<script lang="ts">
  import { resolve } from '$app/paths';
  import { page } from '$app/state';
  import { Label } from '@repo/components/ui/label';

  let { data } = $props();
</script>

<svelte:head>
  <title>{data.title} · Orvo</title>
  <meta name="description" content={data.description} />
  {#if data.draft}
    <meta name="robots" content="noindex" />
  {/if}
</svelte:head>

<div
  class="mx-auto flex w-full max-w-6xl flex-col gap-6 px-3 pt-24 pb-16 md:flex-row md:gap-3 md:px-6"
>
  <aside
    class="border-border w-full shrink-0 md:sticky md:top-24 md:max-h-[calc(100svh-7rem)] md:w-60 md:self-start md:overflow-y-auto"
  >
    <nav aria-label="Legal documents" class="pb-6">
      <Label class="text-muted-foreground/80 text-sm font-normal tracking-wide uppercase">
        Legal
      </Label>
      <div class="mt-2 grid gap-0">
        {#each data.documents as document (document.slug)}
          <a
            href={resolve('/legal/[page]', { page: document.slug })}
            aria-current={`/legal/${document.slug}` === page.url.pathname ? 'page' : undefined}
            class:text-primary!={`/legal/${document.slug}` === page.url.pathname}
            class="text-muted-foreground hover:text-foreground rounded-md py-1.5 text-sm transition-colors"
          >
            {document.title}
          </a>
        {/each}
      </div>
    </nav>
  </aside>

  <main class="min-w-0 flex-1">
    {#if data.draft}
      <div class="bg-muted/50 mx-3 mb-8 rounded-xl border px-4 py-3 text-sm" role="note">
        <p class="font-medium">Draft for review</p>
        <p class="text-muted-foreground mt-1">
          This document is not yet effective. Bracketed details and operational commitments need
          confirmation by Sopeasy, LLC before publication as a final policy.
        </p>
      </div>
    {/if}
    <article class="docs-content prose max-w-4xl px-3 [&_h1,&_h2,&_h3,&_h4,&_h5]:font-medium">
      <!-- eslint-disable-next-line svelte/no-at-html-tags -- HTML is rendered server-side from repository-owned Markdown, never user input. -->
      {@html data.content}
    </article>
  </main>
</div>
