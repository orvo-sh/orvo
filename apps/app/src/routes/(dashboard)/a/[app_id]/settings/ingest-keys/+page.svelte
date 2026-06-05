<script lang="ts">
	import { getIngestionKeyQuery, rotateIngestionKeyCommand } from '$lib/api/ingestion-key.remote';
	import { IconCopy as CopyIcon } from "@tabler/icons-svelte";
	import { Button } from '@repo/components/ui/button';
	import { onMount } from 'svelte';

	let loading = $state(true);
	let rotatingKind = $state<'public' | 'private' | null>(null);
	let error = $state('');
	let publicKey = $state('');
	let privateKey = $state('');

	const loadIngestionKeys = async () => {
		loading = true;
		error = '';

		const [publicResult, privateResult] = await Promise.all([
			getIngestionKeyQuery({ kind: 'public' }),
			getIngestionKeyQuery({ kind: 'private' })
		]);

		if (publicResult.success === false) {
			error = publicResult.error;
			loading = false;
			return;
		}

		if (privateResult.success === false) {
			error = privateResult.error;
			loading = false;
			return;
		}

		publicKey = publicResult.data.key?.key ?? '';
		privateKey = privateResult.data.key?.key ?? '';
		loading = false;
	};

	const copyKey = async (value: string) => {
		await navigator.clipboard.writeText(value);
	};

	const rotateKey = async (kind: 'public' | 'private') => {
		rotatingKind = kind;
		error = '';

		const result = await rotateIngestionKeyCommand({ kind });
		if (result.success === false) {
			error = result.error;
			rotatingKind = null;
			return;
		}

		if (kind === 'public') {
			publicKey = result.data.key;
		} else {
			privateKey = result.data.key;
		}

		rotatingKind = null;
	};

	onMount(() => {
		void loadIngestionKeys();
	});
</script>

<div class="mx-auto flex w-full max-w-5xl flex-col gap-12 py-1">
	{#if error}
		<div class="rounded-lg border border-destructive/20 bg-destructive/5 px-4 py-3 text-sm text-destructive">
			{error}
		</div>
	{/if}

	<section class="space-y-4">
		<div class="space-y-1.5">
			<h2 class="text-2xl font-semibold tracking-tight text-foreground">Public</h2>
			<p class="text-sm text-muted-foreground">
				For browser and client-side OpenTelemetry SDKs. Send it as `Authorization: Bearer pk_...`.
			</p>
		</div>

		<div class="flex flex-col gap-3 rounded-xl border p-4">
			<div class="flex flex-col gap-3 sm:flex-row sm:items-center">
				<div class="border-input bg-background flex h-12 min-w-0 flex-1 items-center rounded-lg border px-4">
					<code class="block min-w-0 truncate text-sm text-foreground">
						{loading ? 'Loading...' : publicKey}
					</code>
				</div>

				<Button
					variant="outline"
					size="icon"
					aria-label="Copy public ingestion key"
					disabled={!publicKey}
					onclick={() => copyKey(publicKey)}
				>
					<CopyIcon data-slot="button-icon" />
				</Button>

				<Button
					variant="outline"
					disabled={loading || rotatingKind === 'private'}
					loading={rotatingKind === 'public'}
					onclick={() => rotateKey('public')}
				>
					Rotate
				</Button>
			</div>
		</div>
	</section>

	<section class="space-y-4">
		<div class="space-y-1.5">
			<h2 class="text-2xl font-semibold tracking-tight text-foreground">Private</h2>
			<p class="text-sm text-muted-foreground">
				For server-side ingestion and backend services. Send it as `Authorization: Bearer sk_...`.
			</p>
		</div>

		<div class="flex flex-col gap-3 rounded-xl border p-4">
			<div class="flex flex-col gap-3 sm:flex-row sm:items-center">
				<div class="border-input bg-background flex h-12 min-w-0 flex-1 items-center rounded-lg border px-4">
					<code class="block min-w-0 truncate text-sm text-foreground">
						{loading ? 'Loading...' : privateKey}
					</code>
				</div>

				<Button
					variant="outline"
					size="icon"
					aria-label="Copy private ingestion key"
					disabled={!privateKey}
					onclick={() => copyKey(privateKey)}
				>
					<CopyIcon data-slot="button-icon" />
				</Button>

				<Button
					variant="outline"
					disabled={loading || rotatingKind === 'public'}
					loading={rotatingKind === 'private'}
					onclick={() => rotateKey('private')}
				>
					Rotate
				</Button>
			</div>
		</div>
	</section>
</div>
