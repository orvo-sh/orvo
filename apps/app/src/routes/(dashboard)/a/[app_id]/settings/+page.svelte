<script lang="ts">
	import { updateAppSettingsCommand } from '$lib/api/apps.remote';
	import { getSupportedTimezones, normalizeTimeZone } from '$lib/timezone';
	import { Button } from '@repo/components/ui/button';
	import {
		Card,
		CardContent,
		CardDescription,
		CardHeader,
		CardTitle
	} from '@repo/components/ui/card';
	import { Input } from '@repo/components/ui/input';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();

	const timezoneOptions = getSupportedTimezones();
	const currentApp = $derived(data.currentApp ?? null);

	let timezone = $state('UTC');
	let saving = $state(false);
	let error = $state('');
	let success = $state('');

	$effect(() => {
		timezone = data.currentApp?.defaultTimezone ?? 'UTC';
	});

	const save = async () => {
		if (!currentApp) {
			return;
		}

		const normalizedTimezone = normalizeTimeZone(timezone);
		if (!normalizedTimezone) {
			error = 'Choose a valid IANA timezone.';
			success = '';
			return;
		}

		saving = true;
		error = '';
		success = '';

		const result = await updateAppSettingsCommand({
			defaultTimezone: normalizedTimezone
		});

		if (result.success === false) {
			error = result.error;
			saving = false;
			return;
		}

		timezone = normalizedTimezone;
		success = 'App settings updated.';
		saving = false;
		location.reload();
	};
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
			<CardTitle>App defaults</CardTitle>
			<CardDescription>
				Choose the default timezone used when rendering timestamps for this app.
			</CardDescription>
		</CardHeader>
		<CardContent class="grid gap-4">
			<div class="grid gap-2">
				<label class="text-sm font-medium text-foreground" for="app-timezone">
					Default timezone
				</label>
				<Input
					id="app-timezone"
					bind:value={timezone}
					list="app-timezone-options"
					placeholder="UTC"
				/>
				<datalist id="app-timezone-options">
					{#each timezoneOptions as timezoneOption}
						<option value={timezoneOption}></option>
					{/each}
				</datalist>
				<p class="text-sm text-muted-foreground">
					{currentApp
						? `Applies to logs for ${currentApp.name}.`
						: 'Choose a valid IANA timezone such as UTC or Africa/Harare.'}
				</p>
				{#if timezone.trim() && !normalizeTimeZone(timezone)}
					<p class="text-sm text-destructive">Choose a valid IANA timezone.</p>
				{/if}
			</div>

			<div class="flex justify-end">
				<Button disabled={saving || !normalizeTimeZone(timezone)} loading={saving} onclick={save}>
					Save changes
				</Button>
			</div>
		</CardContent>
	</Card>
</div>
