<script>
  import DashboardOverviewScreenshot from '$lib/assets/dashboard-logs-screenshot.png';
  import { GolangIcon } from '@repo/components/icons/golang';
  import { JavaIcon } from '@repo/components/icons/java';
  import { NodejsIcon } from '@repo/components/icons/nodejs';
  import { PythonIcon } from '@repo/components/icons/python';
  import { RustIcon } from '@repo/components/icons/rust';
  import { ZigIcon } from '@repo/components/icons/zig';
  import { Button } from '@repo/components/ui/button';
  import { IconChevronRight } from '@tabler/icons-svelte';
</script>

<section
  class="from-muted border-foreground/20 flex w-full flex-col items-center justify-center overflow-hidden border-b bg-linear-to-t to-transparent"
>
  <div class="flex w-full max-w-6xl flex-col gap-10 px-3 pt-16 md:gap-16 md:px-6 md:pt-20">
    <div class="relative">
      <h1 class="mt-8 max-w-3xl text-3xl font-semibold text-balance lg:text-6xl">
        Things brea<span class="relative inline-block translate-y-1 rotate-10" aria-hidden="true"
          >k</span
        >. Orvo shows you 
        <span
          class="after:bg-primary/10 absolute after:absolute after:bottom-0 after:left-[-3%] after:h-full after:w-[106%] after:rounded-sm"
        >
          why.</span
        >
      </h1>
      <p class="text-secondary-foreground mt-2 mb-6 max-w-234 text-lg leading-relaxed text-balance">
        Monitor apps, infra, and jobs from one place. Built on OpenTelemetry and powered by logs,
        traces, metrics, alerts, and heartbeats.
      </p>

      <div class="flex flex-col items-center gap-3 *:w-full sm:flex-row sm:*:w-fit">
        <Button variant="default" href="/" size="lg"
          >Start free trial
          <div class="bg-primary-foreground/15 rounded-full p-0.5">
            <IconChevronRight />
          </div>
        </Button>
        <Button href="/docs" size="lg" variant="outline">View documentation</Button>
      </div>

      <div class="mt-10">
        <div class="inline-flex w-fit flex-wrap items-center gap-x-3 gap-y-2 px-3 py-2.5">
          <div class="flex flex-wrap items-center gap-x-4 gap-y-2 text-sm">
            <span class="text-muted-foreground">Works with</span>
            {#each [{ label: 'Node.js', component: NodejsIcon }, { label: 'Go', component: GolangIcon }, { label: 'Python', component: PythonIcon }, { label: 'Java', component: JavaIcon }, { label: 'Rust', component: RustIcon }, { label: 'Zig', component: ZigIcon }] as runtime (runtime.label)}
              <div class="text-secondary-foreground inline-flex items-center gap-1.5">
                <svelte:component this={runtime.component} class="size-4.5" />
                <span>{runtime.label}</span>
              </div>
            {/each}
            <span class="text-muted-foreground">+ any OpenTelemetry SDK</span>
          </div>
        </div>
      </div>

      <img
        src={DashboardOverviewScreenshot}
        class="ring-border border-foreground/20 z-0 rounded-xl rounded-b-none border border-b-0 shadow-xl ring-3"
        alt="app screen"
        width="2813"
        height="1489"
      />
    </div>
  </div>
</section>
