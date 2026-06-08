<script lang="ts">
	import { goto } from '$app/navigation';
	import { page } from '$app/state';
	import { createEmptyAlertRuleForm, type AlertRuleFormValue } from '$lib/alerts';
	import { createAlertRuleCommand } from '$lib/api/alert-rules.remote';
	import { getAlertWebhookDestinationsQuery } from '$lib/api/alert-webhook-destinations.remote';
	import { onMount } from 'svelte';
	import PageContainer from '../../../../_components/page-container/page-container.svelte';
	import AlertRuleForm from '../_components/alert-rule-form.svelte';

	let loading = $state(true);
	let submitting = $state(false);
	let error = $state('');
	let destinations = $state<Array<{ id: string; name: string; isEnabled: boolean }>>([]);
	let form = $state<AlertRuleFormValue>(createEmptyAlertRuleForm());

	const loadDestinations = async () => {
		loading = true;
		error = '';

		const result = await getAlertWebhookDestinationsQuery({}).run();
		if (result.success === false) {
			error = result.error;
			loading = false;
			return;
		}

		destinations = result.data.destinations.map((destination) => ({
			id: destination.id,
			name: destination.name,
			isEnabled: destination.isEnabled
		}));
		loading = false;
	};

	const submit = async () => {
		submitting = true;
		error = '';

		const result = await createAlertRuleCommand(form);
		if (result.success === false) {
			error = result.error;
			submitting = false;
			return;
		}

		await goto(`/a/${page.params.app_id}/alerts/${result.data.id}`);
	};

	onMount(() => {
		void loadDestinations();
	});
</script>

<PageContainer title="New alert rule">
	{#if loading}
		<div class="rounded-xl border px-4 py-8 text-sm text-muted-foreground">Loading...</div>
	{:else}
		<AlertRuleForm bind:form {destinations} {submitting} {error} submitLabel="Create rule" onSubmit={submit} />
	{/if}
</PageContainer>
