<script lang="ts" module>
  import type { HTMLAnchorAttributes, HTMLButtonAttributes } from 'svelte/elements';
  import { tv, type VariantProps } from 'tailwind-variants';
  import { cn, type WithElementRef } from '../../../utils.js';

  export const buttonVariants = tv({
    base: " focus-visible:ring-ring/40 disabled:cursor-not-allowed aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive dark:aria-invalid:border-destructive/50 rounded-lg border border-transparent bg-clip-padding text-sm font-medium focus-visible:ring-3 active:not-aria-[haspopup]:translate-y-px aria-invalid:ring-3 [&_svg:not([class*='size-'])]:size-4 group/button inline-flex shrink-0 items-center justify-center whitespace-nowrap transition-all outline-none select-none disabled:pointer-events-none [&_svg]:opacity-80 [&_svg]:pointer-events-none [&_svg]:shrink-0",
    variants: {
      variant: {
        default:
          'bg-primary not-disabled:inset-shadow-[0_1px_--theme(--color-white/16%)] border-[color-mix(in_oklab,_theme(colors.primary)_100%,_theme(colors.black)_10%)] text-primary-foreground hover:bg-[color-mix(in_oklab,_theme(colors.primary)_100%,_theme(colors.black)_5%)] disabled:opacity-50',
        outline:
          'border-input not-disabled:inset-shadow-[0_-2px_--theme(--color-muted)] bg-card disabled:text-muted-foreground disabled:bg-secondary hover:bg-muted hover:text-foreground dark:bg-input/30 dark:border-input dark:hover:bg-input/50 aria-expanded:bg-muted aria-expanded:text-foreground',
        secondary:
          'bg-secondary text-secondary-foreground hover:bg-secondary/80 aria-expanded:bg-secondary aria-expanded:text-secondary-foreground disabled:opacity-50',
        ghost:
          'hover:bg-muted hover:text-foreground dark:hover:bg-muted/50 aria-expanded:bg-muted aria-expanded:text-foreground disabled:opacity-50',
        destructive:
          'bg-destructive/10 disabled:opacity-50 hover:bg-destructive/20 focus-visible:ring-destructive/20 dark:focus-visible:ring-destructive/40 dark:bg-destructive/20 text-destructive focus-visible:border-destructive/40 dark:hover:bg-destructive/30',
        link: 'text-primary underline-offset-4 hover:underline disabled:opacity-50'
      },
      size: {
        default:
          'h-8 gap-1.5 px-2.5 has-data-[icon=inline-end]:pr-2 has-data-[icon=inline-start]:pl-2',
        xs: "h-6 gap-1 rounded-[min(var(--radius-md),10px)] px-2 text-xs in-data-[slot=button-group]:rounded-lg has-data-[icon=inline-end]:pr-1.5 has-data-[icon=inline-start]:pl-1.5 [&_svg:not([class*='size-'])]:size-3",
        sm: "h-7 gap-1 rounded-[min(var(--radius-md),12px)] px-2.5 text-[0.8rem] in-data-[slot=button-group]:rounded-lg has-data-[icon=inline-end]:pr-1.5 has-data-[icon=inline-start]:pl-1.5 [&_svg:not([class*='size-'])]:size-3.5",
        lg: 'h-10 gap-1.5 px-3.5 has-data-[icon=inline-end]:pr-2 has-data-[icon=inline-start]:pl-2',
        icon: 'size-8 [&_svg]:opacity-100',
        'icon-xs':
          "size-6 rounded-[min(var(--radius-md),10px)] in-data-[slot=button-group]:rounded-lg [&_svg:not([class*='size-'])]:size-3 [&_svg]:opacity-100",
        'icon-sm':
          'size-7 rounded-[min(var(--radius-md),12px)] in-data-[slot=button-group]:rounded-lg [&_svg]:opacity-100',
        'icon-lg': 'size-9 [&_svg]:opacity-100'
      }
    },
    defaultVariants: {
      variant: 'default',
      size: 'default'
    }
  });

  export type ButtonVariant = VariantProps<typeof buttonVariants>['variant'];
  export type ButtonSize = VariantProps<typeof buttonVariants>['size'];

  export type ButtonProps = WithElementRef<HTMLButtonAttributes> &
    WithElementRef<HTMLAnchorAttributes> & {
      variant?: ButtonVariant;
      size?: ButtonSize;
      loading?: boolean;
      loaderPosition?: 'left' | 'right';
    };
</script>

<script lang="ts">
  import { Spinner } from '../spinner/index.js';

  let {
    class: className,
    variant = 'default',
    size = 'default',
    loading = false,
    loaderPosition = 'left',
    ref = $bindable(null),
    href = undefined,
    type = 'button',
    disabled,
    children,
    ...restProps
  }: ButtonProps = $props();
</script>

{#if href}
  <a
    bind:this={ref}
    data-slot="button"
    data-loading={loading ? 'true' : undefined}
    class={cn(
      buttonVariants({ variant, size }),
      loading && '[&_[data-slot=button-icon]]:hidden',
      className
    )}
    href={disabled || loading ? undefined : href}
    aria-disabled={disabled || loading}
    aria-busy={loading || undefined}
    role={disabled || loading ? 'link' : undefined}
    tabindex={disabled || loading ? -1 : undefined}
    {...restProps}
  >
    {#if loading && loaderPosition === 'left'}
      <Spinner class="loader size-4" aria-hidden="true" />
    {/if}
    {@render children?.()}
    {#if loading && loaderPosition === 'right'}
      <Spinner class="loader size-4" aria-hidden="true" />
    {/if}
  </a>
{:else}
  <button
    bind:this={ref}
    data-slot="button"
    data-loading={loading ? 'true' : undefined}
    class={cn(
      buttonVariants({ variant, size }),
      loading && '[&_[data-slot=button-icon]]:hidden',
      className
    )}
    aria-busy={loading || undefined}
    {type}
    disabled={disabled || loading}
    {...restProps}
  >
    {#if loading && loaderPosition === 'left'}
      <Spinner class="loader size-4" aria-hidden="true" />
    {/if}
    {@render children?.()}
    {#if loading && loaderPosition === 'right'}
      <Spinner class="loader size-4" aria-hidden="true" />
    {/if}
  </button>
{/if}
