<script lang="ts">
	import { Button } from '@repo/components/ui/button';
	import { Textarea } from '@repo/components/ui/textarea';
	import { IconArrowUp, IconPlayerStop } from '@tabler/icons-svelte';

	let {
		value = $bindable(''),
		busy = false,
		disabled = false,
		compact = false,
		placeholder = 'Ask Orvo...',
		onSubmit,
		onStop
	}: {
		value?: string;
		busy?: boolean;
		disabled?: boolean;
		compact?: boolean;
		placeholder?: string;
		onSubmit: () => void | Promise<void>;
		onStop: () => void | Promise<void>;
	} = $props();

	const submit = async () => {
		if (busy || disabled || !value.trim()) {
			return;
		}

		await onSubmit();
	};

	const handleKeydown = (event: KeyboardEvent) => {
		if (event.key !== 'Enter' || event.shiftKey) {
			return;
		}

		event.preventDefault();
		void submit();
	};
</script>

<div class="border-t bg-background/95 p-3">
	<div class="flex items-end gap-2 rounded-xl border bg-background p-2 shadow-sm">
		<Textarea
			bind:value
			{placeholder}
			disabled={disabled}
			onkeydown={handleKeydown}
			class={compact ? 'max-h-32 min-h-10 resize-none border-0 p-1 text-sm shadow-none focus-visible:ring-0' : 'max-h-40 min-h-12 resize-none border-0 p-1.5 shadow-none focus-visible:ring-0'}
			aria-label="Ask Orvo"
		/>

		{#if busy}
			<Button
				variant="outline"
				size="icon-sm"
				onclick={() => void onStop()}
				aria-label="Stop response"
			>
				<IconPlayerStop data-slot="button-icon" />
			</Button>
		{:else}
			<Button
				size="icon-sm"
				onclick={() => void submit()}
				disabled={disabled || !value.trim()}
				aria-label="Send message"
			>
				<IconArrowUp data-slot="button-icon" />
			</Button>
		{/if}
	</div>
</div>
