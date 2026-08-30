<script lang="ts">
  import { cn } from '@repo/components';
  import { GitHubIcon } from '@repo/components/icons/github';
  import { OrvoLogo } from '@repo/components/icons/orvo-logo';
  import { Button } from '@repo/components/ui/button';
  import * as NavigationMenu from '@repo/components/ui/navigation-menu';
  import * as Sheet from '@repo/components/ui/sheet';
  import { IconMenu } from '@tabler/icons-svelte';
  import type { HTMLAttributes } from 'svelte/elements';

  let { githubStars }: { githubStars: number } = $props();

  const productFeatures = [
    {
      href: '/docs/product/traces',
      title: 'Distributed tracing',
      content: 'Follow requests across services and dependencies.'
    },
    {
      href: '/docs/product/logs',
      title: 'Log management',
      content: 'Search, filter, and investigate application logs.'
    },
    {
      href: '/docs/product/metrics',
      title: 'Metrics monitoring',
      content: 'Track performance, errors, and system health.'
    },
    {
      href: '/docs/product/alerts',
      title: 'Alerting',
      content: 'Get notified before small issues escalate.'
    },
    {
      href: '/docs/product/heartbeats',
      title: 'Heartbeat monitoring',
      content: 'Detect failed jobs and missing check-ins.'
    },
    {
      href: '/#features',
      title: 'Scout',
      content: 'Investigate telemetry with an AI assistant.'
    },
    {
      href: '/#features',
      title: 'MCP',
      content: 'Connect compatible agents to scoped telemetry tools.'
    }
  ];

  let mobileSheetOpen = $state(false);
</script>

<header class={'bg-background border-border fixed top-0 z-30 w-full border-b'}>
  <div
    class="relative mx-auto flex max-w-6xl items-center justify-between px-3 py-2 sm:px-6 sm:py-3"
  >
    <a href="/">
      <OrvoLogo class="size-10" />
    </a>

    <NavigationMenu.Root class="absolute left-1/2 hidden -translate-x-1/2 lg:flex">
      <NavigationMenu.List class="gap-2">
        <NavigationMenu.Item>
          <NavigationMenu.Trigger class="h-8!">Product</NavigationMenu.Trigger>
          <NavigationMenu.Content class="p-0!">
            <ul class="grid w-90 p-0">
              {#each productFeatures as productFeatures, i (i)}
                {@render ListItem(productFeatures)}
              {/each}
            </ul>
          </NavigationMenu.Content>
        </NavigationMenu.Item>

        <NavigationMenu.Item>
          <NavigationMenu.Link>
            {#snippet child()}
              <Button href="/docs/getting-started/local-mode" variant="ghost">Local</Button>
            {/snippet}
          </NavigationMenu.Link>
        </NavigationMenu.Item>

        <NavigationMenu.Item>
          <NavigationMenu.Link>
            {#snippet child()}
              <Button href="/pricing" variant="ghost">Pricing</Button>
            {/snippet}
          </NavigationMenu.Link>
        </NavigationMenu.Item>
      </NavigationMenu.List>
    </NavigationMenu.Root>

    <NavigationMenu.Root class="ml-auto hidden justify-end lg:flex">
      <NavigationMenu.List class="gap-2">
        <NavigationMenu.Item>
          <NavigationMenu.Link>
            {#snippet child()}
              <Button href="/docs" variant="ghost">Docs</Button>
            {/snippet}
          </NavigationMenu.Link>
        </NavigationMenu.Item>

        <NavigationMenu.Item>
          <NavigationMenu.Link>
            {#snippet child()}
              <Button href="https://app.orvo.sh/sign-in" variant="ghost">Sign in</Button>
            {/snippet}
          </NavigationMenu.Link>
        </NavigationMenu.Item>

        <NavigationMenu.Item>
          <NavigationMenu.Link>
            {#snippet child()}
              <Button href="https://app.orvo.sh/sign-up">Start free trial</Button>
            {/snippet}
          </NavigationMenu.Link>
        </NavigationMenu.Item>

        <NavigationMenu.Item>
          <a
            href="https://github.com/orvo-sh/orvo"
            target="_blank"
            rel="noreferrer"
            aria-label={`View Orvo on GitHub`}
            class="border-foreground/20 bg-background hover:bg-foreground/5 focus-visible:ring-ring inline-flex h-8 overflow-hidden rounded-lg border transition-colors outline-none focus-visible:ring-2"
          >
            <span class="border-foreground/20 flex w-8 items-center justify-center border-r">
              <GitHubIcon alt="" class="size-4 dark:invert" />
            </span>
            <span class="flex items-center px-3 font-mono text-sm font-medium">
              {new Intl.NumberFormat('en', {
                notation: 'compact',
                maximumFractionDigits: 1
              }).format(githubStars)}
            </span>
          </a>
        </NavigationMenu.Item>
      </NavigationMenu.List>
    </NavigationMenu.Root>
    <Sheet.Root bind:open={mobileSheetOpen}>
      <Sheet.Trigger>
        {#snippet child({ props }: { props: any })}
          <Button variant="outline" size="icon" class="lg:hidden" {...props}>
            <IconMenu data-slot="button-icon" />
            <span class="sr-only">Open menu</span>
          </Button>
        {/snippet}
      </Sheet.Trigger>

      <Sheet.Content side="right" class="w-full max-w-sm gap-0 p-0 lg:hidden">
        <Sheet.Header class="border-b">
          <Sheet.Title>Menu</Sheet.Title>
        </Sheet.Header>
        <div class="flex flex-1 flex-col overflow-y-auto p-1 pt-2">
          <div class="space-y-1">
            <Button
              href="/docs/getting-started/local-mode"
              variant="ghost"
              class="w-full justify-start"
              onclick={() => {
                queueMicrotask(() => {
                  mobileSheetOpen = false;
                });
              }}
            >
              Local
            </Button>

            <Button
              href="/pricing"
              variant="ghost"
              class="w-full justify-start"
              onclick={() => {
                queueMicrotask(() => {
                  mobileSheetOpen = false;
                });
              }}
            >
              Pricing
            </Button>

            <Button
              href="/docs"
              variant="ghost"
              class="w-full justify-start"
              onclick={() => {
                queueMicrotask(() => {
                  mobileSheetOpen = false;
                });
              }}
            >
              Docs
            </Button>

            <Button
              href="https://app.orvo.sh/sign-in"
              variant="ghost"
              class="w-full justify-start"
              onclick={() => {
                queueMicrotask(() => {
                  mobileSheetOpen = false;
                });
              }}
            >
              Sign in
            </Button>
          </div>

          <div class="border-border mt-2 space-y-1">
            <p class="text-primary px-3 py-3 text-xs font-medium tracking-[0.16em] uppercase">
              Product
            </p>

            {#each productFeatures as productFeature, i (i)}
              <Button
                href={productFeature.href}
                variant="ghost"
                class="w-full justify-start"
                onclick={() => {
                  queueMicrotask(() => {
                    mobileSheetOpen = false;
                  });
                }}
              >
                {productFeature.title}
              </Button>
            {/each}
          </div>
        </div>

        <Sheet.Footer class="bg-secondary gap-2 border-t p-3 pb-4">
          <Button
            href="https://app.orvo.sh/sign-up"
            class="w-full"
            onclick={() => {
              queueMicrotask(() => {
                mobileSheetOpen = false;
              });
            }}
          >
            Start free trial
          </Button>
          <Button
            href="https://app.orvo.sh/sign-in"
            class="w-full"
            variant="outline"
            onclick={() => {
              queueMicrotask(() => {
                mobileSheetOpen = false;
              });
            }}
          >
            Sign in
          </Button>
        </Sheet.Footer>
      </Sheet.Content>
    </Sheet.Root>
  </div>
</header>

{#snippet ListItem({
  title,
  content,
  href,
  class: className,
  ...restProps
}: HTMLAttributes<HTMLAnchorElement> & {
  title: string;
  href: string;
  content: string;
})}
  <li>
    <NavigationMenu.Link>
      {#snippet child()}
        <a
          {href}
          class={cn(
            'hover:bg-accent hover:text-accent-foreground focus:bg-accent focus:text-accent-foreground block space-y-1 rounded-md p-3 pb-2 leading-none no-underline transition-colors outline-none select-none',
            className
          )}
          {...restProps}
        >
          <div class="text-sm leading-none font-medium">{title}</div>
          <p class="text-muted-foreground line-clamp-2 text-sm leading-snug">
            {content}
          </p>
        </a>
      {/snippet}
    </NavigationMenu.Link>
  </li>
{/snippet}
