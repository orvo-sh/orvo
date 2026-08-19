<script lang="ts">
  /* eslint-disable svelte/no-navigation-without-resolve -- external URLs are data-driven */
  import { resolve } from '$app/paths';
  import { OrvoLogo } from '@repo/components/icons/orvo-logo';
  import { IconBrandGithub, IconExternalLink } from '@tabler/icons-svelte';

  const links = [
    {
      label: 'Product',
      items: [
        { label: 'Features', href: '/#features', external: false },
        { label: 'Open source', href: '/#open-source', external: false },
        { label: 'Pricing', href: '/#pricing', external: false },
        { label: 'Roadmap', href: 'https://feedback.orvo.sh/roadmap', external: true }
      ]
    },
    {
      label: 'Telemetry',
      items: [
        { label: 'Logs', href: '/docs/product/logs', external: false },
        { label: 'Traces', href: '/docs/product/traces', external: false },
        { label: 'Metrics', href: '/docs/product/metrics', external: false },
        { label: 'Heartbeats', href: '/docs/product/heartbeats', external: false }
      ]
    },
    {
      label: 'Resources',
      items: [
        { label: 'Documentation', href: '/docs', external: false },
        { label: 'GitHub', href: 'https://github.com/orvo-sh/orvo', external: true },
        { label: 'Sign in', href: 'https://app.orvo.sh/sign-in', external: true },
        { label: 'Create account', href: 'https://app.orvo.sh/sign-up', external: true }
      ]
    }
  ] as const;
</script>

<footer class="bg-muted/20">
  <div class="mx-auto grid max-w-6xl gap-10 px-3 py-12 sm:px-6 md:grid-cols-[1.3fr_2fr] md:py-16">
    <div class="max-w-sm">
      <a href={resolve('/')} aria-label="Orvo home" class="inline-flex">
        <OrvoLogo class="size-10" />
      </a>
      <p class="text-muted-foreground mt-4 text-sm leading-relaxed">
        Open-source observability built on OpenTelemetry. Understand production without stitching
        the story together across five different tools.
      </p>
      <a
        href="https://github.com/orvo-sh/orvo"
        target="_blank"
        rel="noreferrer"
        class="text-muted-foreground hover:text-foreground mt-5 inline-flex items-center gap-2 text-sm transition-colors"
      >
        <IconBrandGithub class="size-4" />
        orvo-sh/orvo
      </a>
    </div>

    <div class="grid grid-cols-2 gap-8 sm:grid-cols-3">
      {#each links as group (group.label)}
        <div>
          <p class="text-sm font-medium">{group.label}</p>
          <ul class="mt-4 space-y-3">
            {#each group.items as item (item.label)}
              <li>
                {#if item.external}
                  <a
                    href={item.href}
                    target="_blank"
                    rel="noreferrer"
                    class="text-muted-foreground hover:text-foreground inline-flex items-center gap-1.5 text-sm transition-colors"
                  >
                    {item.label}
                    <IconExternalLink class="size-3" />
                  </a>
                {:else}
                  <a
                    href={resolve(item.href)}
                    class="text-muted-foreground hover:text-foreground inline-flex items-center gap-1.5 text-sm transition-colors"
                  >
                    {item.label}
                  </a>
                {/if}
              </li>
            {/each}
          </ul>
        </div>
      {/each}
    </div>
  </div>

  <div class="border-border border-t">
    <div
      class="text-muted-foreground mx-auto flex max-w-6xl flex-col gap-2 px-3 py-5 text-xs sm:flex-row sm:items-center sm:justify-between sm:px-6"
    >
      <p>© {new Date().getFullYear()} Orvo</p>
      <p>Licensed under AGPL-3.0</p>
    </div>
  </div>
</footer>
