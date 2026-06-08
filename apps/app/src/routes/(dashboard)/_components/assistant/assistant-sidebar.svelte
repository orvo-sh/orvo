<script lang="ts">
	import { page } from '$app/state';
	import { Button } from '@repo/components/ui/button';
	import { IconX, IconMaximize } from '@tabler/icons-svelte';
	import { goto } from '$app/navigation';
	import AssistantConversation from './assistant-conversation.svelte';
	import { assistantSidebarState } from '$lib/stores/assistant-sidebar.svelte';

	let {
		appId,
		hidden = false
	}: {
		appId?: string;
		hidden?: boolean;
	} = $props();

	const openFullChat = async () => {
		assistantSidebarState.open = false;
		await goto(`/a/${appId}/chat`);
	};
</script>

{#if appId && !hidden && assistantSidebarState.open}
	<div
		class="bg-background flex h-full w-96 min-w-96 flex-col border-l shadow-xl sm:shadow-none"
	>
		<div class="flex h-13 shrink-0 items-center justify-between border-b px-4">
			<span class="text-sm font-semibold tracking-tight text-foreground">Ask Orvo</span>
			<div class="flex items-center gap-1">
				<Button variant="ghost" size="icon-sm" onclick={openFullChat} aria-label="Open full chat">
					<IconMaximize data-slot="button-icon" />
				</Button>
				<Button variant="ghost" size="icon-sm" onclick={() => (assistantSidebarState.open = false)} aria-label="Close Ask Orvo">
					<IconX data-slot="button-icon" />
				</Button>
			</div>
		</div>

		<AssistantConversation
			{appId}
			mode="compact"
			class="min-h-0 flex-1 border-none rounded-none shadow-none"
			onNavigateFull={() => (assistantSidebarState.open = false)}
		/>
	</div>
{/if}
