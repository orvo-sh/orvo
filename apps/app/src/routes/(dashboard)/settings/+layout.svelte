<script lang="ts">
	import { page } from '$app/state';
	import * as Sidebar from '@repo/components/ui/sidebar';

	import { PageContainer } from '../_components/page-container';

	let { children }: { children?: import('svelte').Snippet } = $props();

	const items = [
		{
			href: '/settings/billing',
			label: 'Billing',
			isActive: (pathname: string) => pathname.startsWith('/settings/billing')
		}
	];

	const activeItem = $derived(items.find((item) => item.isActive(page.url.pathname)) ?? items[0]);
</script>

<PageContainer title={activeItem?.label ?? 'Settings'} innerClass="p-0!">
	<div class="flex min-h-0 flex-1 flex-col gap-6 lg:flex-row lg:gap-8">
		<aside class="hidden w-64 shrink-0 border-r lg:block">
			<Sidebar.Group>
				<Sidebar.GroupLabel>Organization</Sidebar.GroupLabel>
				<Sidebar.GroupContent>
					<Sidebar.Menu>
						{#each items as item}
							<Sidebar.MenuItem>
								<Sidebar.MenuButton isActive={item.isActive(page.url.pathname)}>
									{#snippet child({ props })}
										<a href={item.href} {...props}>
											<span>{item.label}</span>
										</a>
									{/snippet}
								</Sidebar.MenuButton>
							</Sidebar.MenuItem>
						{/each}
					</Sidebar.Menu>
				</Sidebar.GroupContent>
			</Sidebar.Group>
		</aside>

		<div class="min-h-0 min-w-0 flex-1">
			{@render children?.()}
		</div>
	</div>
</PageContainer>
