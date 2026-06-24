<script>
  import { cn } from '@repo/components';
  import { OrvoLogo } from '@repo/components/icons/orvo-logo';
  import { Button } from '@repo/components/ui/button';

  let scrollTop = $state(0);
</script>

<svelte:document
  onscroll={(e) => {
    scrollTop = e.currentTarget?.scrollingElement?.scrollTop ?? 0;
  }}
/>

<header
  class={cn(
    'border-foreground/10 bg-background fixed top-0 z-30 w-full transition-colors',
    scrollTop > 50 && 'border-b'
  )}
>
  <div class="mx-auto flex max-w-6xl items-center justify-between px-6 py-4 lg:px-8">
    <a href="#top" class="flex items-center gap-3 font-medium tracking-tight">
      <OrvoLogo class="size-7 rounded-md" />
      <span>Orvo</span>
    </a>

    <nav class="text-muted-foreground hidden items-center gap-8 text-sm md:flex">
      <a href="#features" class="hover:text-foreground transition-colors">Features</a>
      <a href="#pricing" class="hover:text-foreground transition-colors">Pricing</a>
      <a href="https://orvo.sh/docs" class="hover:text-foreground transition-colors">Docs</a>
    </nav>

    <div class="flex items-center gap-2">
      <Button href="https://app.orvo.sh/sign-in" variant="ghost" class="hidden sm:inline-flex">
        Sign in
      </Button>
      <Button href="https://app.orvo.sh/sign-up">Start free trial</Button>
    </div>
  </div>
</header>
