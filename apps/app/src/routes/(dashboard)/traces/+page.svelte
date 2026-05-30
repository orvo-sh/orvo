<script lang="ts">
	import { getTracesQuery } from '$lib/api/traces.remote';
	import { Button, buttonVariants } from '@repo/components/ui/button';
	import { ButtonGroup } from '@repo/components/ui/button-group';
	import * as DropdownMenu from '@repo/components/ui/dropdown-menu';
	import {
		ArrowsClockwiseIcon,
		CaretDownIcon,
		CopyIcon,
		FloppyDiskIcon,
		PencilSimpleIcon,
		PlayIcon,
		TrashIcon
	} from 'phosphor-svelte';
	import PageContainer from '../_components/page-container.svelte';
	import TraceFilterBar from './_components/trace-filter-bar.svelte';
	import TraceTable from './_components/trace-table.svelte';
	import type { TraceFilters, TraceRow } from './types';

	let live = $state(false);
	let rangeStart = $state(new Date(Date.now() - 10 * 60 * 60 * 1000));
	let rangeEnd = $state(new Date());
	let traces = $state<TraceRow[]>([]);
	let loading = $state(false);
	let error = $state('');
	let loadRequest = 0;

	$effect(() => {
		if (!live) return;
		const id = setInterval(() => { rangeEnd = new Date(); }, 5000);
		return () => clearInterval(id);
	});

	let filters = $state<TraceFilters>({
		search: '',
		services: [],
		environments: [],
		statusCodes: []
	});

	const createTracesInput = () => ({
		time: {
			kind: 'range' as const,
			startAtUtc: rangeStart.toISOString(),
			endAtUtc: rangeEnd.toISOString()
		},
		search: filters.search.trim(),
		services: filters.services,
		environments: filters.environments,
		scopes: [],
		ingestionKeyIds: [],
		statusCodes: filters.statusCodes.map((statusCode) => Number(statusCode)),
		limit: 250
	});

	const refreshTraces = async () => {
		const requestId = ++loadRequest;
		loading = true;
		error = '';

		const result = await getTracesQuery(createTracesInput()).run();

		if (requestId !== loadRequest) {
			return;
		}

		if (result.success === false) {
			error = result.error;
			loading = false;
			return;
		}

		traces = result.data.traces;
		loading = false;
	};

	const querySignature = $derived.by(() =>
		JSON.stringify({
			start: rangeStart.toISOString(),
			end: rangeEnd.toISOString(),
			search: filters.search,
			services: filters.services,
			environments: filters.environments,
			statusCodes: filters.statusCodes
		})
	);

	const serviceOptions = $derived(
		[...new Set(traces.flatMap((trace) => trace.service_names))].map((service) => ({
			value: service,
			label: service
		}))
	);
	const environmentOptions = $derived(
		[...new Set(traces.flatMap((trace) => trace.deployment_environments))].map((environment) => ({
			value: environment,
			label: environment
		}))
	);

	function refresh() { rangeEnd = new Date(); }

	$effect(() => {
		const signature = querySignature;

		const timeout = setTimeout(() => {
			if (!signature) return;
			void refreshTraces();
		}, 250);

		return () => clearTimeout(timeout);
	});
</script>

<PageContainer title="Traces" class="overflow-hidden">
	{#snippet actions()}
		<Button
			variant="outline"
			onclick={() => { live = !live; if (live) rangeEnd = new Date(); }}
			class={live ? 'border-green-500/50 text-green-600 dark:text-green-400' : ''}
		>
			{#if live}
				<span class="size-2 rounded-full bg-green-500 animate-pulse" data-slot="button-icon"></span>
				Live
			{:else}
				<PlayIcon data-slot="button-icon" />
				Live
			{/if}
		</Button>

		{#if !live}
			<Button variant="outline" onclick={refresh}>
				<ArrowsClockwiseIcon data-slot="button-icon" />
				Refresh
			</Button>
		{/if}

		<ButtonGroup>
			<Button variant="outline">
				<FloppyDiskIcon data-slot="button-icon" />
				Save view
			</Button>
			<DropdownMenu.Root>
				<DropdownMenu.Trigger
					aria-label="Open saved view actions"
					class={buttonVariants({ variant: 'outline', size: 'icon' })}
				>
					<CaretDownIcon />
				</DropdownMenu.Trigger>
				<DropdownMenu.Content align="end" class="w-52">
					<DropdownMenu.Item variant="destructive"><TrashIcon />Delete view</DropdownMenu.Item>
					<DropdownMenu.Item><PencilSimpleIcon />Rename view</DropdownMenu.Item>
					<DropdownMenu.Item><CopyIcon />Duplicate view</DropdownMenu.Item>
					<DropdownMenu.Separator />
					<DropdownMenu.Item><FloppyDiskIcon />Save as new view</DropdownMenu.Item>
				</DropdownMenu.Content>
			</DropdownMenu.Root>
		</ButtonGroup>
	{/snippet}

	<div class="flex flex-col min-h-0 flex-1 -mx-4 -my-4 md:-mx-6 md:-my-5">
		<TraceFilterBar
			bind:start={rangeStart}
			bind:end={rangeEnd}
			bind:filters
			{serviceOptions}
			{environmentOptions}
		/>
		{#if error}
			<div class="border-b border-destructive/20 bg-destructive/5 px-4 py-2 text-sm text-destructive">
				{error}
			</div>
		{/if}
		<TraceTable {traces} {filters} {loading} />
	</div>
</PageContainer>
