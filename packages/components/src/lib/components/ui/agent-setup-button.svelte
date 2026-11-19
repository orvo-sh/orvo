<script lang="ts">
  import { ClaudeCodeIcon } from '../icons/claude-code/index.js';
  import { CodexIcon } from '../icons/codex/index.js';
  import { CursorIcon } from '../icons/cursor/index.js';
  import { Button } from './button/index.js';
  import { IconCircleCheckFilled, IconExclamationCircle } from '@tabler/icons-svelte';
  import { onDestroy } from 'svelte';

  import { cn } from '../../utils.js';

  let {
    prompt,
    label = 'Set up with your agent',
    variant = 'outline',
    size = 'lg',
    onClick,
    onCopied
  }: {
    prompt: string;
    label?: string;
    variant?: 'outline' | 'default';
    size?: 'default' | 'lg';
    onClick?: () => void;
    onCopied?: () => void;
  } = $props();

  const tileClass = $derived(
    variant === 'default'
      ? 'border-2 border-primary bg-white'
      : 'group-hover/button:border-muted border-2 border-white bg-neutral-200 dark:bg-neutral-700'
  );

  const confetti = [
    [-90, -15, -105],
    [-78, 10, 80],
    [-62, -17, 135],
    [-54, 15, -75],
    [56, -16, 110],
    [68, 13, -125],
    [84, -11, -85],
    [94, 9, 95]
  ];

  let copyState = $state<'idle' | 'copied' | 'error'>('idle');
  let copyCount = $state(0);
  let feedbackTimeout: ReturnType<typeof setTimeout> | undefined;

  const copySetupPrompt = async () => {
    onClick?.();
    try {
      await navigator.clipboard.writeText(prompt);
      copyState = 'copied';
      copyCount += 1;
      onCopied?.();
    } catch {
      copyState = 'error';
    }
    clearTimeout(feedbackTimeout);
    feedbackTimeout = setTimeout(() => (copyState = 'idle'), 2500);
  };

  onDestroy(() => clearTimeout(feedbackTimeout));
</script>

<div>
  <Button
    {size}
    {variant}
    class={cn(
      'relative w-full overflow-hidden',
      variant === 'outline' && 'dark:bg-card dark:hover:bg-muted'
    )}
    aria-label={label}
    onclick={copySetupPrompt}
  >
    {#if copyState === 'copied'}
      {#key copyCount}
        <span class="pointer-events-none absolute inset-0 motion-reduce:hidden" aria-hidden="true">
          {#each confetti as [x, y, rotation]}
            <span
              class="confetti-piece"
              style:--x={`${x}px`}
              style:--y={`${y}px`}
              style:--rotation={`${rotation}deg`}
            ></span>
          {/each}
        </span>
      {/key}
    {/if}
    <span class="relative grid items-center justify-items-center" aria-hidden="true">
      <span
        class="col-start-1 row-start-1 flex items-center gap-2 transition-[translate,opacity] duration-200 motion-reduce:transition-none"
        class:-translate-y-5={copyState !== 'idle'}
        class:opacity-0={copyState !== 'idle'}
      >
        <span data-slot="button-icon" class="isolate flex -space-x-1.5">
          <span
            class={cn(
              tileClass,
              'z-20 grid size-6 place-items-center rounded-full transition-colors motion-reduce:transition-none'
            )}
          >
            <ClaudeCodeIcon class="size-3.5" alt="" />
          </span>
          <span
            class={cn(
              tileClass,
              'z-10 grid size-6 place-items-center rounded-full transition-colors motion-reduce:transition-none'
            )}
          >
            <CodexIcon class={cn('size-3.5', variant === 'outline' && 'dark:invert')} alt="" />
          </span>
          <span
            class={cn(
              tileClass,
              'grid size-6 place-items-center rounded-full transition-colors motion-reduce:transition-none'
            )}
          >
            <CursorIcon class="size-3.5" alt="" />
          </span>
        </span>
        {label}
      </span>
      <span
        class="col-start-1 row-start-1 flex items-center gap-1.5 transition-[translate,opacity] duration-200 motion-reduce:transition-none"
        class:translate-y-5={copyState === 'idle'}
        class:opacity-0={copyState === 'idle'}
      >
        {#if copyState === 'error'}
          <IconExclamationCircle />
          Couldn’t copy. Try again
        {:else}
          <span class="text-green-600 dark:text-green-400" class:copy-check={copyState === 'copied'}
            ><IconCircleCheckFilled class="!opacity-100" /></span
          >
          Prompt copied
        {/if}
      </span>
    </span>
  </Button>
  <span class="sr-only" role="status">
    {copyState === 'copied'
      ? 'Prompt copied'
      : copyState === 'error'
        ? 'Could not copy the prompt'
        : ''}
  </span>
</div>

<style>
  .confetti-piece {
    position: absolute;
    top: 50%;
    left: 50%;
    width: 4px;
    height: 6px;
    border-radius: 1px;
    background: var(--primary);
    animation: confetti-burst 600ms cubic-bezier(0.15, 0.7, 0.3, 1) both;
  }

  .confetti-piece:nth-child(3n + 2) {
    background: #f1a330;
  }

  .confetti-piece:nth-child(3n + 3) {
    background: #39a98a;
  }

  @keyframes confetti-burst {
    0% {
      opacity: 0;
      transform: translate(calc(var(--x) * 0.55), 0) scale(0.25);
    }
    25% {
      opacity: 1;
    }
    100% {
      opacity: 0;
      transform: translate(var(--x), var(--y)) rotate(var(--rotation)) scale(0.55);
    }
  }

  @media (prefers-reduced-motion: no-preference) {
    .copy-check {
      animation: check-pop 320ms ease-out both;
    }
  }

  @keyframes check-pop {
    0% {
      transform: scale(0.55) rotate(-20deg);
    }
    65% {
      transform: scale(1.25) rotate(6deg);
    }
    100% {
      transform: scale(1);
    }
  }
</style>
