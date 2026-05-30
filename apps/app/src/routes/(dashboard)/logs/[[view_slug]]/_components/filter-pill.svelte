<script lang="ts">
	import {
		IconCheck as CheckIcon,
		IconChevronDown as CaretDownIcon,
		IconX as XIcon
	} from "@tabler/icons-svelte";
	import { Input } from '@repo/components/ui/input';
	import * as Popover from '@repo/components/ui/popover';
	// `icon` is a renderable snippet passed from callers; keep flexible to avoid
	// importing a non-existent `Snippet` type from `svelte`.

	let {
		label,
		icon,
		values = $bindable<string[]>([]),
		options,
		placeholder = 'Search...'
	}: {
		label: string;
		icon?: any;
		values?: string[];
		options: { value: string; label: string; color?: string }[];
		placeholder?: string;
	} = $props();

	let open = $state(false);
	let search = $state('');

	const filtered = $derived(
		options.filter((o) => o.label.toLowerCase().includes(search.toLowerCase()))
	);

	const hasSelection = $derived(values.length > 0);
	const clearLabel = $derived(`Clear ${label} filter`);

	function toggle(value: string) {
		if (values.includes(value)) {
			values = values.filter((v) => v !== value);
		} else {
			values = [...values, value];
		}
	}

	function clear(e: MouseEvent) {
		e.stopPropagation();
		values = [];
	}
</script>

<Popover.Root bind:open>
	<Popover.Trigger>
		{#snippet child({ props })}
			<div
				{...props}
				class="inline-flex h-8 items-center gap-1 rounded-md border border-dashed px-2.5 text-sm
					transition-colors hover:bg-muted/60
					{hasSelection
					? 'border-primary/40 bg-primary/5 text-foreground'
					: 'border-border text-muted-foreground hover:text-foreground'}"
			>
				{#if icon}
					<span class="size-3.5">{@render icon()}</span>
				{/if}
				<span class="font-medium">{label}</span>
				{#if hasSelection}
					<span
						class="ml-0.5 rounded bg-primary/15 px-1 py-px text-[10px] font-semibold text-primary leading-none"
					>
						{values.length}
					</span>
					<button
						type="button"
						class="ml-0.5 rounded text-muted-foreground hover:text-foreground transition-colors"
						onclick={clear}
						aria-label={clearLabel}
					>
						<XIcon class="size-3" />
					</button>
				{:else}
					<CaretDownIcon class="size-3 ml-0.5" />
				{/if}
			</div>
		{/snippet}
	</Popover.Trigger>

	<Popover.Content class="w-52 p-0 overflow-hidden" align="start">
		<!-- Search -->
		<div class="border-b px-2 py-2">
			<Input
				{placeholder}
				bind:value={search}
				class="h-7 text-xs bg-transparent border-0 shadow-none focus-visible:ring-0 px-1"
			/>
		</div>

		<!-- Options -->
		<div class="max-h-52 overflow-y-auto py-1">
			{#each filtered as option}
				{@const selected = values.includes(option.value)}
				<button
					type="button"
					class="flex w-full items-center gap-2 px-3 py-1.5 text-sm hover:bg-muted/60 transition-colors"
					onclick={() => toggle(option.value)}
				>
					<span
						class="flex size-4 shrink-0 items-center justify-center rounded border border-border transition-colors
						{selected ? 'bg-primary border-primary text-primary-foreground' : ''}"
					>
						{#if selected}
							<CheckIcon class="size-2.5" />
						{/if}
					</span>
					{#if option.color}
						<span class="size-2 rounded-full shrink-0" style="background: {option.color}"></span>
					{/if}
					<span class="text-foreground truncate">{option.label}</span>
				</button>
			{/each}
			{#if filtered.length === 0}
				<p class="px-3 py-2 text-xs text-muted-foreground">No results</p>
			{/if}
		</div>

		{#if hasSelection}
			<div class="border-t px-2 py-1.5">
				<button
					type="button"
					class="w-full text-xs text-muted-foreground hover:text-foreground text-center transition-colors"
					onclick={() => (values = [])}
				>
					Clear selection
				</button>
			</div>
		{/if}
	</Popover.Content>
</Popover.Root>
