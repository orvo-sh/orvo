<script lang="ts">
  import { Avatar as AvatarPrimitive } from 'bits-ui';
  import { cn } from '../../../utils.js';

  let {
    ref = $bindable(null),
    class: className,
    id,
    name,
    ...restProps
  }: AvatarPrimitive.FallbackProps & {
    id?: string;
    name?: string;
  } = $props();

  const getColors = (id: string) => {
    let hash = 0;
    for (let i = 0; i < id.length; i++) {
      hash = id.charCodeAt(i) + ((hash << 5) - hash);
    }

    const h = Math.abs(hash % 360);
    const s = 60;
    const l = 47;
    const h2 = (h + 30) % 360;

    const background = `hsl(${h2}, ${s}%, ${l}%)`;
    const textColor = '#ffffff';
    return { gradient: background, textColor };
  };

  const getInitials = (name: string) => {
    const names = name.split(' ');
    if (names.length == 1) {
      return names[0].slice(0, 1).toUpperCase() + names[0].slice(1, 2).toLowerCase();
    } else {
      return names[0].charAt(0) + names.at(-1)?.charAt(0);
    }
  };
</script>

<AvatarPrimitive.Fallback
  bind:ref
  data-slot="avatar-fallback"
  style={id ? `background: ${getColors(id).gradient}; color: ${getColors(id).textColor}` : ''}
  class={cn(
    'text-muted-foreground flex size-full items-center justify-center rounded-full text-sm group-data-[size=sm]/avatar:text-xs',
    className,
    !id && 'bg-muted'
  )}
  {...restProps}
>
  {#if name}
    {getInitials(name)}
  {:else}
    {@render restProps.children?.()}
  {/if}
</AvatarPrimitive.Fallback>
