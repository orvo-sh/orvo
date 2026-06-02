<script lang="ts">
	import { cn } from "@repo/components";
	import { Button, buttonVariants } from "@repo/components/ui/button";
	import * as ButtonGroup from "@repo/components/ui/button-group";
	import { Input } from '@repo/components/ui/input';
	import * as Popover from '@repo/components/ui/popover';
	import {
	    IconChevronDown as CaretDownIcon,
	    IconCheck as CheckIcon,
	    IconCircleX,
	    IconSearch,
	    IconX
	} from "@tabler/icons-svelte";

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
		options: { value: string; label: string; }[];
		placeholder?: string;
	} = $props();

	let open = $state(false);
	let search = $state('');

	const filtered = $derived(
		options.filter((o) => o.label.toLowerCase().includes(search.toLowerCase()))
	);

	const toggle = (value: string)=> {
		if (values.includes(value)) {
			values = values.filter((v) => v !== value);
		} else {
			values = [...values, value];
		}
	}
</script>

<ButtonGroup.Root>
<Popover.Root bind:open>
	<Popover.Trigger class={buttonVariants({size:"sm", class:cn("items-center pr-1.5 h-6 shadow-none gap-1 border-dashed", values.length > 0 && "border-solid"), variant:"outline"})}>
				{#if icon}
					<span class="size-3.5">{@render icon()}</span>
				{/if}
				<span class="font-medium text-sm">{label}</span>
				{#if values.length > 0 }
					<span
						class="rounded bg-primary/15 px-1 py-px mr-0.5 text-[10px] ml-1 font-semibold text-primary leading-none"
					>
						{values.length}
					</span>
				
				{/if}
				{#if values.length == 0}
				<CaretDownIcon class="size-3.5" />
				{/if}
	</Popover.Trigger>

	<Popover.Content class="w-52 p-0 gap-0 overflow-hidden" align="start">
		<div class="border-b px-2 py-1 relative flex items-center">
			<IconSearch
			class="absolute left-2.5 size-3.5 text-muted-foreground pointer-events-none"
		/>
			<Input
				{placeholder}
				bind:value={search}
				class="h-7 text-xs pl-6 bg-transparent border-0 shadow-none focus-visible:ring-0"
			/>
			{#if search}
			<Button class="size-6 opacity-80" size="icon-sm" variant="ghost" onclick={()=>{search = ""}}>
				<IconCircleX />
			</Button>
			{/if}
		</div>
		<div class="max-h-52 overflow-y-auto">
			{#each filtered as option}
				{@const selected = values.includes(option.value)}
				<button
					type="button"
					class="flex w-full items-center gap-2 px-3 py-1.5 text-sm hover:bg-muted/60 transition-colors"
					onclick={() => toggle(option.value)}
				>
					<span
						class="flex size-4 shrink-0 items-center justify-center"
					
					>
						{#if selected}
							<CheckIcon class="size-3" />
						{/if}
					</span>
					<span class="text-foreground truncate">{option.label}</span>
				</button>
			{/each}
			{#if filtered.length === 0}
				<p class="pl-9 py-2 text-sm text-muted-foreground">No results.</p>
			{/if}
		</div>
	</Popover.Content>
</Popover.Root>
{#if values.length}
<Button class="h-6" size="icon-sm" variant="outline" onclick={()=>{
	values = [];
}}>
	<IconX class="size-3" />
</Button>
{/if}
</ButtonGroup.Root>