<script lang="ts">
	import { page } from '$app/state';
	import { Button } from '@repo/components/ui/button';
	import { IconLayoutDashboard } from '@tabler/icons-svelte';
	import AssistantConversation from '../../../_components/assistant/assistant-conversation.svelte';
	import PageContainer from '../../../_components/page-container/page-container.svelte';

	const appId = $derived(page.params.app_id ?? '');
</script>

<PageContainer
	title="Ask Orvo"
	scrollContent={false}
	innerClass="p-0 md:p-0"
	class="bg-secondary"
>
	{#snippet actions()}
		<Button href={`/a/${appId}/overview`} variant="outline" size="sm">
			<IconLayoutDashboard data-slot="button-icon" />
			Overview
		</Button>
	{/snippet}

	{#if appId}
		<div class="min-h-0 flex-1 p-3 md:p-4">
			<AssistantConversation {appId} mode="full" class="h-full" />
		</div>
	{/if}
</PageContainer>
