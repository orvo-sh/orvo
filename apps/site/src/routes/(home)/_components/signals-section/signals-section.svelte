<script lang="ts">
  import { AwsIcon } from '@repo/components/icons/aws';
  import { DockerIcon } from '@repo/components/icons/docker';
  import { GolangIcon } from '@repo/components/icons/golang';
  import { NodejsIcon } from '@repo/components/icons/nodejs';
  import { PythonIcon } from '@repo/components/icons/python';
  import { Button } from '@repo/components/ui/button';

  import { OrvoLogo } from '@repo/components/icons/orvo-logo';
  import { RustIcon } from '@repo/components/icons/rust';
  import {
    IconBox,
    IconChartBar,
    IconHeartbeat,
    IconTelescope,
    IconTerminal2
  } from '@tabler/icons-svelte';
  import SignalsSectionNode from './signals-section-node.svelte';

  const signals = [
    {
      label: 'Logs',
      icon: IconTerminal2,
      class: 'absolute top-2 left-14 -rotate-10 shadow-[0_12px_28px_rgba(15,23,42,0.08)]'
    },
    {
      label: 'Traces',
      icon: IconTelescope,
      class: 'absolute top-12 -right-2 rotate-8 shadow-[0_14px_30px_rgba(15,23,42,0.1)]'
    },
    {
      label: 'Metrics',
      icon: IconChartBar,
      class: 'absolute bottom-4 right-10 -rotate-6 shadow-[0_14px_28px_rgba(15,23,42,0.08)]'
    },
    {
      label: 'Heartbeats',
      icon: IconHeartbeat,
      class: 'absolute bottom-2 left-2 rotate-7 shadow-[0_12px_26px_rgba(15,23,42,0.09)]'
    }
  ];

  type Link = {
    from: string;
    to: string;
  };

  const links: Link[] = [
    { from: 'apps', to: 'logs' },
    { from: 'apps', to: 'traces' },
    { from: 'apps', to: 'metrics' },
    { from: 'logs', to: 'orvo' },
    { from: 'traces', to: 'orvo' },
    { from: 'metrics', to: 'orvo' }
  ];

  let diagramEl: HTMLDivElement;
  let paths = $state<string[]>([]);

  function drawLinks() {
    if (!diagramEl) return;

    const rootBox = diagramEl.getBoundingClientRect();

    paths = links
      .map((link) => {
        const from = diagramEl.querySelector(`[data-node="${link.from}"]`);
        const to = diagramEl.querySelector(`[data-node="${link.to}"]`);

        if (!from || !to) return null;

        const a = from.getBoundingClientRect();
        const b = to.getBoundingClientRect();

        const x1 = a.left + a.width / 2 - rootBox.left;
        const y1 = a.top + a.height / 2 - rootBox.top;
        const x2 = b.left + b.width / 2 - rootBox.left;
        const y2 = b.top + b.height / 2 - rootBox.top;

        const midY = (y1 + y2) / 2;

        return `M ${x1} ${y1} C ${x1} ${midY}, ${x2} ${midY}, ${x2} ${y2}`;
      })
      .filter(Boolean) as string[];
  }

  $effect(() => {
    drawLinks();

    window.addEventListener('resize', drawLinks);

    return () => {
      window.removeEventListener('resize', drawLinks);
    };
  });
</script>

<section class="bg-foreground/7 z-100 flex min-h-96 w-full items-center justify-center py-14">
  <div class="flex w-full max-w-6xl flex-col gap-14 px-6 lg:flex-row lg:items-center lg:gap-16">
    <div class="flex-1">
      <h2 class="text-3xl font-medium">Built around OpenTelemetry.</h2>
      <p class="text-secondary-foreground mt-3 max-w-[58.5rem] leading-relaxed text-balance">
        Logs, traces, metrics, and heartbeats, all in one place. Built on OpenTelemetry and
        designed to help you understand production without stitching together multiple tools.
      </p>
      <div class="mt-6 flex flex-col items-center gap-3 *:w-full sm:flex-row sm:*:w-fit">
        <Button variant="default" href="/">Start free trial</Button>
        <Button href="/docs" variant="outline">Learn more</Button>
      </div>
    </div>

    <div bind:this={diagramEl} class="flex flex-1 items-center justify-center">
      <svg class="pointer-events-none absolute inset-0 z-0 h-full w-full overflow-visible">
        {#each paths as d}
          <path {d} fill="none" stroke="currentColor" stroke-width="1" class="text-border" />
        {/each}
      </svg>
      <div class="flex w-full flex-col items-center gap-12">
        <div class="relative flex flex-col">
          <SignalsSectionNode
            data-node="golang"
            class="bg-border absolute top-1 -left-8 z-50 flex size-fit flex-1 items-center justify-center rounded-full p-1.5! inset-shadow-[2px_2px_--theme(--color-white)]"
          >
            <GolangIcon class="size-5.5" />
          </SignalsSectionNode>

          <SignalsSectionNode
            data-node="node"
            class="bg-border absolute -top-6 left-10 z-50 flex size-fit flex-1 items-center justify-center rounded-full p-1.5! inset-shadow-[1px_2px_--theme(--color-white)]"
          >
            <NodejsIcon class="size-5.5" />
          </SignalsSectionNode>

          <SignalsSectionNode
            data-node="python"
            class="bg-border absolute -bottom-8 left-6 z-50 flex size-fit flex-1 items-center justify-center rounded-full p-1.5! inset-shadow-[2px_2px_--theme(--color-white)]"
          >
            <PythonIcon class="size-5.5" />
          </SignalsSectionNode>

          <SignalsSectionNode
            data-node="docker"
            class="bg-border absolute top-8 -right-5 z-50 flex size-fit flex-1 items-center justify-center rounded-full p-1.5! inset-shadow-[1px_2px_--theme(--color-white)]"
          >
            <DockerIcon class="size-5.5" />
          </SignalsSectionNode>
          <SignalsSectionNode
            class="bg-border absolute -top-6 right-0 z-50 flex size-fit flex-1 items-center justify-center rounded-full p-1.5! inset-shadow-[2px_2px_--theme(--color-white)]"
          >
            <AwsIcon class="size-5.5" />
          </SignalsSectionNode>
          <SignalsSectionNode
            data-node="rust"
            class="bg-border absolute -top-12 -right-8 z-50  flex size-fit flex-1 items-center justify-center rounded-full p-1.5! inset-shadow-[2px_2px_--theme(--color-white)]"
          >
            <RustIcon class="size-5.5" />
          </SignalsSectionNode>
          <SignalsSectionNode
            data-node="apps"
            class=" w-full flex-col justify-center shadow-[0_14px_42px_rgba(37,99,235,0.16)]"
          >
            <span class="flex items-center gap-2">
              <IconBox class="text-muted-foreground size-4 stroke-2" />
              YOUR APPS AND INFRA
            </span>
          </SignalsSectionNode>
        </div>

        <div class="relative flex h-52 w-full items-center justify-center">
          {#each signals as signal}
            <SignalsSectionNode class={signal.class} data-node={signal.label}>
              <span class="flex items-center gap-2">
                <signal.icon class="text-muted-foreground size-4 stroke-2" />
                {signal.label}
              </span>
            </SignalsSectionNode>
          {/each}

          <div
            class="border-border/70 relative z-10 flex size-20 items-center justify-center rounded-full border bg-white shadow-[0_18px_48px_rgba(15,23,42,0.12)]"
          >
            <OrvoLogo class="size-14" />
          </div>
        </div>
      </div>
    </div>
  </div>
</section>

<style>
  .flow-line {
    position: relative;
    overflow: hidden;
  }

  .flow-line::before {
    content: '';
    position: absolute;
    inset: 0;
    border-radius: 9999px;
  }

  .flow-line-y::before {
    background: linear-gradient(
      180deg,
      #fff 0%,
      #fff 32%,
      hsl(var(--primary)) 50%,
      #fff 68%,
      #fff 100%
    );
    background-size: 100% 260%;
    animation: flow-y 2.4s linear infinite;
  }

  @keyframes flow-y {
    from {
      background-position: 0 -200%;
    }

    to {
      background-position: 0 200%;
    }
  }
</style>
