<script lang="ts">
	import { Button, buttonVariants } from '@repo/components/ui/button';
	import { ButtonGroup } from '@repo/components/ui/button-group';
	import * as DropdownMenu from '@repo/components/ui/dropdown-menu';
	import {
	    ArrowsClockwiseIcon,
	    CaretDownIcon,
	    CopyIcon,
	    FloppyDiskIcon,
	    PencilSimpleIcon,
	    TrashIcon
	} from 'phosphor-svelte';
	import PageContainer from '../../_components/page-container.svelte';
	import LogFilterBar from './_components/log-filter-bar.svelte';
	import LogTable from './_components/log-table.svelte';
	import LogVolumeChart from './_components/log-volume-chart.svelte';
	import type { LogFilters, LogRecord } from './types';

	let hasView = $state(true);

	// Default time window: last 10 hours
	let rangeStart = $state(new Date(Date.now() - 10 * 60 * 60 * 1000));
	let rangeEnd = $state(new Date());

	let filters = $state<LogFilters>({
		search: '',
		levels: [],
		services: [],
		scopes: [],
		environments: [],
		traceId: ''
	});

	// --- Mock data -------------------------------------------------------
	// In production this would come from a server load or streaming fetch
	// keyed on rangeStart/rangeEnd and filters.

	const SERVICES = ['api-gateway', 'auth-service', 'billing', 'worker', 'mailer'];
	const ENVS = ['production', 'staging'];
	const LEVELS = [
		{ text: 'INFO', num: 9 },
		{ text: 'INFO', num: 9 },
		{ text: 'INFO', num: 9 },
		{ text: 'DEBUG', num: 5 },
		{ text: 'WARN', num: 13 },
		{ text: 'ERROR', num: 17 },
		{ text: 'FATAL', num: 21 }
	];
	const BODIES = [
		'Request completed successfully',
		'Database connection established',
		'Cache miss — falling back to origin',
		'[404] GET /wp-includes/js/jquery/jquery.js',
		'[500] POST /api/v1/checkout — upstream timeout',
		'[403] GET /.env — blocked',
		'Saving metrics to "/tmp/app-metrics.json"',
		'Current period usage: {"successful":0,"timedout":0,"totalTime":0}',
		'Worker heartbeat OK',
		'Email dispatched to user@example.com',
		'Retrying failed job #8821 (attempt 2/3)',
		'Auth token validated — user_id=usr_29xk3',
		'Stripe webhook received: invoice.paid',
		'Outgoing request to https://api.stripe.com/v1/charges',
		'Background task completed in 142ms'
	];

	function rand<T>(arr: T[]): T {
		return arr[Math.floor(Math.random() * arr.length)];
	}

	const MOCK_LOGS: LogRecord[] = Array.from({ length: 180 }, () => {
		const svc = rand(SERVICES);
		const env = rand(ENVS);
		const lvl = rand(LEVELS);
		const t = new Date(
			rangeStart.getTime() +
				Math.random() * (rangeEnd.getTime() - rangeStart.getTime())
		);
		return {
			timestamp: t.toISOString(),
			observed_timestamp: t.toISOString(),
			severity_number: lvl.num,
			severity_text: lvl.text,
			body: rand(BODIES),
			trace_id: Math.random() > 0.4 ? crypto.randomUUID().replace(/-/g, '') : '',
			span_id: Math.random() > 0.5 ? crypto.randomUUID().split('-')[0] : '',
			trace_flags: 1,
			resource_attributes: { 'host.name': `${svc}-${Math.ceil(Math.random() * 3)}`, 'host.arch': 'amd64' },
			resource_schema_url: '',
			scope_name: `${svc}/handler`,
			scope_version: '1.0.0',
			scope_attributes: {},
			scope_schema_url: '',
			log_attributes: { request_id: crypto.randomUUID().split('-')[0], latency_ms: String(Math.floor(Math.random() * 2000)) },
			service_name: svc,
			deployment_environment: env
		};
	});
	// --------------------------------------------------------------------

	const serviceOptions = $derived(
		[...new Set(MOCK_LOGS.map((l) => l.service_name).filter(Boolean))].map((s) => ({
			value: s,
			label: s
		}))
	);

	const environmentOptions = $derived(
		[...new Set(MOCK_LOGS.map((l) => l.deployment_environment).filter(Boolean))].map((e) => ({
			value: e,
			label: e
		}))
	);

	const scopeOptions = $derived(
		[...new Set(MOCK_LOGS.map((l) => l.scope_name).filter(Boolean))].map((scope) => ({
			value: scope,
			label: scope
		}))
	);

	function refresh() {
		rangeEnd = new Date();
	}

	function onBucketClick(start: Date, end: Date) {
		rangeStart = start;
		rangeEnd = end;
	}
</script>

<PageContainer title="Logs" class="overflow-hidden">
	{#snippet actions()}
		<Button variant="outline" onclick={refresh}>
			<ArrowsClockwiseIcon data-slot="button-icon" />
			Refresh
		</Button>

		<ButtonGroup>
			<Button variant="outline">
				<FloppyDiskIcon data-slot="button-icon" />
				Save view
			</Button>
			{#if hasView}
				<DropdownMenu.Root>
					<DropdownMenu.Trigger
						aria-label="Open saved view actions"
						class={buttonVariants({ variant: 'outline', size: 'icon' })}
					>
						<CaretDownIcon />
					</DropdownMenu.Trigger>

					<DropdownMenu.Content align="end" class="w-52">
						<DropdownMenu.Item variant="destructive">
							<TrashIcon />
							Delete view
						</DropdownMenu.Item>
						<DropdownMenu.Item>
							<PencilSimpleIcon />
							Rename view
						</DropdownMenu.Item>
						<DropdownMenu.Item>
							<CopyIcon />
							Duplicate view
						</DropdownMenu.Item>
						<DropdownMenu.Separator />
						<DropdownMenu.Item>
							<FloppyDiskIcon />
							Save as new view
						</DropdownMenu.Item>
					</DropdownMenu.Content>
				</DropdownMenu.Root>
			{/if}
		</ButtonGroup>
	{/snippet}

	<!-- Override the page-container inner scroll to get a sticky toolbar + full-height table -->
	{#snippet children()}
		<div class="flex flex-col min-h-0 flex-1 -mx-4 -my-4 md:-mx-6 md:-my-5">
			<!-- Filter bar -->
			<LogFilterBar
				bind:start={rangeStart}
				bind:end={rangeEnd}
				bind:filters
				{serviceOptions}
				{environmentOptions}
				{scopeOptions}
			/>

			<!-- Volume chart -->
			<div class="px-4 pt-3 pb-1 border-b bg-background shrink-0">
				<LogVolumeChart
					logs={MOCK_LOGS}
					start={rangeStart}
					end={rangeEnd}
					{onBucketClick}
				/>
			</div>

			<!-- Log table — fills remaining height -->
			<LogTable logs={MOCK_LOGS} {filters} />
		</div>
	{/snippet}
</PageContainer>
