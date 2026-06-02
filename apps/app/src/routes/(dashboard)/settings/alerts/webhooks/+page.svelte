<script lang="ts">
	import {
		createAlertWebhookDestinationCommand,
		deleteAlertWebhookDestinationCommand,
		getAlertWebhookDestinationsQuery,
		testAlertWebhookDestinationCommand,
		updateAlertWebhookDestinationCommand
	} from '$lib/api/alert-webhook-destinations.remote';
	import { Badge } from '@repo/components/ui/badge';
	import { Button } from '@repo/components/ui/button';
	import {
		Card,
		CardContent,
		CardDescription,
		CardHeader,
		CardTitle
	} from '@repo/components/ui/card';
	import { Checkbox } from '@repo/components/ui/checkbox';
	import { Input } from '@repo/components/ui/input';
	import { onMount } from 'svelte';

	let loading = $state(true);
	let submitting = $state(false);
	let error = $state('');
	let success = $state('');
	let editingId = $state<string | null>(null);
	let testingId = $state('');
	let deletingId = $state('');
	let destinations = $state<
		Array<{
			id: string;
			name: string;
			url: string;
			headers: Array<{ key: string; value: string }>;
			isEnabled: boolean;
			lastTestedAt: Date | null;
		}>
	>([]);
	let form = $state({
		name: '',
		url: '',
		headers: [{ key: '', value: '' }],
		isEnabled: true
	});

	const resetForm = () => {
		editingId = null;
		form = {
			name: '',
			url: '',
			headers: [{ key: '', value: '' }],
			isEnabled: true
		};
	};

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
			url: destination.url,
			headers: destination.headers,
			isEnabled: destination.isEnabled,
			lastTestedAt: destination.lastTestedAt
		}));
		loading = false;
	};

	const submit = async () => {
		submitting = true;
		error = '';
		success = '';

		const sanitizedHeaders = form.headers
			.map((header) => ({
				key: header.key.trim(),
				value: header.value.trim()
			}))
			.filter((header) => header.key && header.value);

		const input = {
			name: form.name,
			url: form.url,
			headers: sanitizedHeaders,
			isEnabled: form.isEnabled
		};
		const result = editingId
			? await updateAlertWebhookDestinationCommand({ id: editingId, ...input })
			: await createAlertWebhookDestinationCommand(input);

		if (result.success === false) {
			error = result.error;
			submitting = false;
			return;
		}

		success = editingId ? 'Webhook destination updated.' : 'Webhook destination created.';
		resetForm();
		await loadDestinations();
		submitting = false;
	};

	const editDestination = (destinationId: string) => {
		const destination = destinations.find((entry) => entry.id === destinationId);
		if (!destination) {
			return;
		}

		editingId = destination.id;
		form = {
			name: destination.name,
			url: destination.url,
			headers:
				destination.headers.length > 0
					? destination.headers.map((header) => ({ ...header }))
					: [{ key: '', value: '' }],
			isEnabled: destination.isEnabled
		};
	};

	const deleteDestination = async (destinationId: string) => {
		const confirmed = window.confirm('Delete this webhook destination?');
		if (!confirmed) {
			return;
		}

		deletingId = destinationId;
		error = '';
		success = '';

		const result = await deleteAlertWebhookDestinationCommand(destinationId);
		if (result.success === false) {
			error = result.error;
			deletingId = '';
			return;
		}

		if (editingId === destinationId) {
			resetForm();
		}

		await loadDestinations();
		deletingId = '';
	};

	const testDestination = async (destinationId: string) => {
		testingId = destinationId;
		error = '';
		success = '';

		const result = await testAlertWebhookDestinationCommand(destinationId);
		if (result.success === false) {
			error = result.error;
			testingId = '';
			return;
		}

		success = 'Webhook test sent.';
		await loadDestinations();
		testingId = '';
	};

	const addHeader = () => {
		form.headers = [...form.headers, { key: '', value: '' }];
	};

	const removeHeader = (index: number) => {
		form.headers = form.headers.filter((_, itemIndex) => itemIndex !== index);
		if (form.headers.length === 0) {
			form.headers = [{ key: '', value: '' }];
		}
	};

	onMount(() => {
		void loadDestinations();
	});
</script>

<div class="mx-auto flex w-full max-w-5xl flex-col gap-6 py-1">
	{#if error}
		<div class="rounded-lg border border-destructive/20 bg-destructive/5 px-4 py-3 text-sm text-destructive">
			{error}
		</div>
	{/if}

	{#if success}
		<div class="rounded-lg border border-border bg-muted px-4 py-3 text-sm text-foreground">
			{success}
		</div>
	{/if}

	<Card>
		<CardHeader class="gap-1">
			<CardTitle>{editingId ? 'Edit webhook destination' : 'New webhook destination'}</CardTitle>
			<CardDescription>Reusable webhook endpoints for alert notifications.</CardDescription>
		</CardHeader>
		<CardContent class="grid gap-4">
			<div class="grid gap-2">
				<label class="text-sm font-medium text-foreground" for="destination-name">Name</label>
				<Input id="destination-name" bind:value={form.name} placeholder="PagerDuty webhook" />
			</div>

			<div class="grid gap-2">
				<label class="text-sm font-medium text-foreground" for="destination-url">Webhook URL</label>
				<Input id="destination-url" bind:value={form.url} placeholder="https://example.com/webhook" />
			</div>

			<div class="grid gap-3">
				<div class="flex items-center justify-between gap-2">
					<div>
						<h3 class="text-sm font-medium text-foreground">Headers</h3>
						<p class="text-sm text-muted-foreground">Optional static headers sent with each request.</p>
					</div>
					<Button variant="outline" type="button" onclick={addHeader}>Add header</Button>
				</div>

				{#each form.headers as header, index (index)}
					<div class="grid gap-2 rounded-xl border p-3 md:grid-cols-[1fr_1fr_auto]">
						<Input bind:value={header.key} placeholder="Authorization" />
						<Input bind:value={header.value} placeholder="Bearer secret" />
						<Button variant="outline" type="button" onclick={() => removeHeader(index)}>Remove</Button>
					</div>
				{/each}
			</div>

			<label class="flex items-center gap-3 rounded-xl border px-4 py-3">
				<Checkbox bind:checked={form.isEnabled} />
				<div class="space-y-1">
					<p class="text-sm font-medium text-foreground">Enabled</p>
					<p class="text-sm text-muted-foreground">Disabled destinations are ignored by alert delivery.</p>
				</div>
			</label>

			<div class="flex items-center justify-end gap-2">
				{#if editingId}
					<Button variant="outline" type="button" onclick={resetForm}>Cancel</Button>
				{/if}
				<Button loading={submitting} onclick={submit}>
					{editingId ? 'Save destination' : 'Create destination'}
				</Button>
			</div>
		</CardContent>
	</Card>

	<Card>
		<CardHeader class="gap-1">
			<CardTitle>Existing destinations</CardTitle>
			<CardDescription>Manage the webhooks available to alert rules.</CardDescription>
		</CardHeader>
		<CardContent class="grid gap-4">
			{#if loading}
				<div class="rounded-xl border px-4 py-8 text-sm text-muted-foreground">Loading...</div>
			{:else if destinations.length === 0}
				<div class="rounded-xl border border-dashed px-4 py-8 text-sm text-muted-foreground">
					No webhook destinations yet.
				</div>
			{:else}
				{#each destinations as destination (destination.id)}
					<div class="rounded-xl border p-4">
						<div class="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
							<div class="space-y-1">
								<div class="flex flex-wrap items-center gap-2">
									<h3 class="text-sm font-medium text-foreground">{destination.name}</h3>
									{#if destination.isEnabled}
										<Badge variant="outline">Enabled</Badge>
									{:else}
										<Badge variant="outline">Disabled</Badge>
									{/if}
								</div>
								<p class="text-sm text-muted-foreground">{destination.url}</p>
								<p class="text-xs text-muted-foreground">
									Last tested:
									{destination.lastTestedAt
										? new Date(destination.lastTestedAt).toLocaleString()
										: 'Never'}
								</p>
							</div>
							<div class="flex flex-wrap items-center gap-2">
								<Button variant="outline" onclick={() => editDestination(destination.id)}>Edit</Button>
								<Button
									variant="outline"
									loading={testingId === destination.id}
									onclick={() => testDestination(destination.id)}
								>
									Test
								</Button>
								<Button
									variant="destructive"
									loading={deletingId === destination.id}
									onclick={() => deleteDestination(destination.id)}
								>
									Delete
								</Button>
							</div>
						</div>
					</div>
				{/each}
			{/if}
		</CardContent>
	</Card>
</div>
