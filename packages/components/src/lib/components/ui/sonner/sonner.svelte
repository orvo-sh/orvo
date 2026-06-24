<script lang="ts">
  import {
    IconCircleCheckFilled as CheckCircleIcon,
    IconInfoCircleFilled as InfoIcon,
    IconLoader2 as SpinnerIcon,
    IconAlertCircleFilled as WarningIcon,
    IconCircleXFilled as XCircleIcon
  } from '@tabler/icons-svelte';
  import { mode } from 'mode-watcher';
  import { Toaster as Sonner, type ToasterProps as SonnerProps } from 'svelte-sonner';

  let { ...restProps }: SonnerProps = $props();
</script>

<Sonner
  theme={mode.current}
  class="toaster group"
  style="--normal-bg: var(--color-popover); --normal-text: var(--color-popover-foreground); --normal-border: var(--color-border);"
  {...restProps}
>
  {#snippet loadingIcon()}
    <SpinnerIcon class="size-4 animate-spin" />
  {/snippet}
  {#snippet successIcon()}
    <CheckCircleIcon class="size-4" />
  {/snippet}
  {#snippet errorIcon()}
    <XCircleIcon class="size-4" />
  {/snippet}
  {#snippet infoIcon()}
    <InfoIcon class="size-4" />
  {/snippet}
  {#snippet warningIcon()}
    <WarningIcon class="size-4" />
  {/snippet}
</Sonner>
