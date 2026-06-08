<script lang="ts">
	import { cn } from '@repo/components';
	import { Badge } from '@repo/components/ui/badge';
	import { Spinner } from '@repo/components/ui/spinner';
	import { getToolName, isToolUIPart, type UIMessage } from 'ai';
	import {
		IconCheck,
		IconDatabaseSearch,
		IconExclamationCircle,
		IconSparkles
	} from '@tabler/icons-svelte';

	let {
		message,
		compact = false,
		streaming = false
	}: {
		message: UIMessage;
		compact?: boolean;
		streaming?: boolean;
	} = $props();

	const toolLabels: Record<string, string> = {
		getAppOverview: 'Checking app',
		getLogVolume: 'Reading log volume',
		searchLogs: 'Searching logs',
		getRecentErrors: 'Finding errors',
		searchTraces: 'Searching traces',
		getTraceDetails: 'Inspecting trace',
		getSlowTraces: 'Finding slow traces',
		getAlertCoverage: 'Reviewing alerts'
	};

	const formatToolName = (name: string) =>
		name
			.replace(/^get/, '')
			.replace(/^search/, '')
			.replace(/([a-z])([A-Z])/g, '$1 $2')
			.trim()
			.toLowerCase();

	const toolStateLabel = (state: string) => {
		if (state === 'output-available') return 'Done';
		if (state === 'output-error') return 'Error';
		if (state === 'input-streaming' || state === 'input-available') return 'Running';
		return 'Pending';
	};

	const splitText = (text: string) =>
		text
			.split(/(\[[^\]]+\]\([^)]+\)|https?:\/\/[^\s)]+|\/a\/[^\s)]+)/g)
			.filter(Boolean)
			.map((part) => {
				const markdownLink = part.match(/^\[([^\]]+)\]\(([^)]+)\)$/);
				if (markdownLink) {
					const [, label, href] = markdownLink;
					return { type: 'link' as const, label, href };
				}

				if (part.startsWith('http://') || part.startsWith('https://') || part.startsWith('/a/')) {
					return { type: 'link' as const, label: part, href: part };
				}

				return { type: 'text' as const, text: part };
			});
</script>

<div
	class={cn(
		'flex w-full gap-3',
		message.role === 'user' ? 'justify-end' : 'justify-start',
		compact && 'gap-2'
	)}
	data-message-role={message.role}
>
	{#if message.role === 'assistant'}
		<div
			class={cn(
				'mt-1 flex size-7 shrink-0 items-center justify-center rounded-lg border bg-background text-foreground shadow-sm',
				compact && 'size-6 rounded-md'
			)}
		>
			<IconSparkles class="size-3.5" />
		</div>
	{/if}

	<div
		class={cn(
			'min-w-0 max-w-[82%]',
			message.role === 'assistant' && 'max-w-[92%] flex-1',
			compact && 'max-w-[90%]'
		)}
	>
		<div
			class={cn(
				message.role === 'user'
					? 'rounded-xl bg-primary px-3 py-2 text-sm leading-6 text-primary-foreground shadow-sm'
					: 'space-y-2 text-sm leading-6 text-foreground',
				compact && message.role === 'user' && 'rounded-lg px-2.5 py-1.5'
			)}
		>
			{#each message.parts as part}
				{#if part.type === 'text'}
					<div class="whitespace-pre-wrap break-words">
						{#each splitText(part.text) as token}
							{#if token.type === 'link'}
								<a
									href={token.href}
									class={cn(
										'font-medium underline underline-offset-4',
										message.role === 'user'
											? 'text-primary-foreground'
											: 'text-primary hover:text-primary/80'
									)}
								>
									{token.label}
								</a>
							{:else}
								{token.text}
							{/if}
						{/each}
					</div>
				{:else if isToolUIPart(part)}
					{@const toolName = getToolName(part)}
					<div
						class={cn(
							'inline-flex max-w-full items-center gap-2 rounded-lg border bg-muted/35 px-2.5 py-1 text-xs text-muted-foreground',
							part.state === 'output-error' && 'border-destructive/30 bg-destructive/5 text-destructive'
						)}
					>
						{#if part.state === 'output-available'}
							<IconCheck class="size-3.5 text-green-600 dark:text-green-400" />
						{:else if part.state === 'output-error'}
							<IconExclamationCircle class="size-3.5" />
						{:else}
							<Spinner class="size-3.5" />
						{/if}
						<span class="truncate">{toolLabels[toolName] ?? formatToolName(toolName)}</span>
						<Badge variant="outline" class="h-4 px-1.5 text-[10px]">
							{toolStateLabel(part.state)}
						</Badge>
					</div>
				{:else if part.type === 'reasoning' && part.text}
					<div class="rounded-lg border bg-muted/30 px-2.5 py-1.5 text-xs text-muted-foreground">
						{part.text}
					</div>
				{:else if part.type === 'source-url'}
					<a
						href={part.url}
						class="inline-flex items-center gap-1 rounded-md border px-2 py-1 text-xs text-primary hover:bg-muted"
					>
						<IconDatabaseSearch class="size-3" />
						{part.title ?? part.url}
					</a>
				{/if}
			{/each}

			{#if streaming && message.role === 'assistant'}
				<span class="inline-flex items-center gap-1 text-xs text-muted-foreground">
					<Spinner class="size-3" />
					Thinking
				</span>
			{/if}
		</div>
	</div>
</div>
