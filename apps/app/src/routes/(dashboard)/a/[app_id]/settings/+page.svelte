<script lang="ts">
	import {
		Card,
		CardContent,
		CardDescription,
		CardHeader,
		CardTitle
	} from '@repo/components/ui/card';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();

	const currentApp = $derived(data.currentApp ?? null);
	const currentTimezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
</script>

<div class="mx-auto flex w-full max-w-5xl flex-col gap-6 py-1">
	<Card>
		<CardHeader class="gap-1">
			<CardTitle>App defaults</CardTitle>
			<CardDescription>
				Orvo now renders timestamps using each viewer&apos;s local device timezone.
			</CardDescription>
		</CardHeader>
		<CardContent class="grid gap-2">
			<p class="text-sm text-foreground">
				{currentApp
					? `Timestamps for ${currentApp.name} follow the timezone from the current browser or device.`
					: 'Timestamps follow the timezone from the current browser or device.'}
			</p>
			<p class="text-sm text-muted-foreground">
				Your current detected timezone is {currentTimezone}.
			</p>
		</CardContent>
	</Card>
</div>
