<script lang="ts">
	import { goto } from '$app/navigation';
	import { page } from '$app/state';
	import { createEmptyAlertRuleForm, type AlertRuleFormValue } from '$lib/alerts';
	import {
	    deleteAlertRuleCommand,
	    getAlertRuleQuery,
	    updateAlertRuleCommand
	} from '$lib/api/alert-rules.remote';
	import { getAlertWebhookDestinationsQuery } from '$lib/api/alert-webhook-destinations.remote';
	import { Button } from '@repo/components/ui/button';
	import { onMount } from 'svelte';
	import PageContainer from '../../../../_components/page-container/page-container.svelte';
	import AlertRuleForm from '../_components/alert-rule-form.svelte';

	let loading = $state(true);
	let submitting = $state(false);
	let deleting = $state(false);
	let error = $state('');
	let destinations = $state<Array<{ id: string; name: string; isEnabled: boolean }>>([]);
	let form = $state<AlertRuleFormValue>(createEmptyAlertRuleForm());

	const ruleId = $derived(page.params.rule_id ?? '');

	const load = async () => {
		loading = true;
		error = '';

		const [ruleResult, destinationsResult] = await Promise.all([
			getAlertRuleQuery(ruleId).run(),
			getAlertWebhookDestinationsQuery({}).run()
		]);

		if (ruleResult.success === false) {
			error = ruleResult.error;
			loading = false;
			return;
		}

		if (destinationsResult.success === false) {
			error = destinationsResult.error;
			loading = false;
			return;
		}

		const rule = ruleResult.data.rule;
		form = {
			name: rule.name,
			signalType: rule.signalType,
			comparator: rule.comparator,
			threshold: rule.threshold,
			windowMinutes: rule.windowMinutes,
			renotifyMinutes: rule.renotifyMinutes,
			apdexTargetMs: rule.apdexTargetMs,
			scope: {
				services: {
					include: rule.scopeServicesInclude,
					exclude: rule.scopeServicesExclude
				},
				spanNames: {
					include: rule.scopeSpanNamesInclude,
					exclude: rule.scopeSpanNamesExclude
				},
				environments: {
					include: rule.scopeEnvironmentsInclude,
					exclude: rule.scopeEnvironmentsExclude
				},
				scopes: {
					include: rule.scopeScopesInclude,
					exclude: rule.scopeScopesExclude
				}
			},
			destinationIds: rule.destinationIds
		};
		destinations = destinationsResult.data.destinations.map((destination) => ({
			id: destination.id,
			name: destination.name,
			isEnabled: destination.isEnabled
		}));
		loading = false;
	};

	const submit = async () => {
		submitting = true;
		error = '';

		const result = await updateAlertRuleCommand({
			id: ruleId,
			...form
		});

		if (result.success === false) {
			error = result.error;
			submitting = false;
			return;
		}

		submitting = false;
	};

	const deleteRule = async () => {
		const confirmed = window.confirm('Delete this alert rule?');
		if (!confirmed) {
			return;
		}

		deleting = true;
		error = '';

		const result = await deleteAlertRuleCommand(ruleId);
		if (result.success === false) {
			error = result.error;
			deleting = false;
			return;
		}

		await goto(`/a/${page.params.app_id}/alerts`);
	};

	onMount(() => {
		void load();
	});
</script>

<PageContainer title="Edit alert rule">
	{#snippet actions()}
		<Button variant="destructive" loading={deleting} onclick={deleteRule}>Delete</Button>
	{/snippet}

	{#if loading}
		<div class="rounded-xl border px-4 py-8 text-sm text-muted-foreground">Loading...</div>
	{:else}
		<AlertRuleForm bind:form {destinations} {submitting} {error} submitLabel="Save rule" onSubmit={submit} />
	{/if}
</PageContainer>
