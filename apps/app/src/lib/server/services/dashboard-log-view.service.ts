import type { Logger } from '@repo/logger';
import { and, desc, eq, type DB } from '@repo/db';
import { dashboardLogView } from '@repo/db/schema';
import { err, genId, generateRandomString, ok, slugify } from '@repo/utils';
import { z } from 'zod';

import { logsQueryFiltersSchema } from './logs.service';

class DashboardLogViewService {
	private logger: Logger;

	constructor(
		private db: DB,
		logger: Logger
	) {
		this.logger = logger.child('DashboardLogViewService');
	}

	async getDashboardLogViews(context: { appId: string }) {
		this.logger.info('getDashboardLogViews: getting dashboard log views', { context });

		try {
			const views = await this.db.query.dashboardLogView.findMany({
				where: eq(dashboardLogView.appId, context.appId),
				orderBy: [desc(dashboardLogView.updatedAt), desc(dashboardLogView.name)]
			});

			return ok({ views });
		} catch (error) {
			this.logger.error('getDashboardLogViews: failed to get dashboard log views', error as Error);
			return err('Failed to get dashboard log views.');
		}
	}

	async createDashboardLogView(
		input: z.infer<typeof createDashboardLogViewInputSchema>,
		context: { userId: string; appId: string }
	) {
		this.logger.info('createDashboardLogView: creating dashboard log view', { input, context });

		const validated = createDashboardLogViewInputSchema.safeParse(input);
		if (!validated.success) {
			return err(validated.error.message);
		}

		try {
			const slug = await this.createUniqueSlug(validated.data.name, context.appId);
			const id = genId('logv');

			await this.db.insert(dashboardLogView).values({
				id,
				appId: context.appId,
				slug,
				name: validated.data.name,
				definition: validated.data.definition,
				createdBy: context.userId,
				updatedBy: context.userId
			});

			return ok({ id });
		} catch (error) {
			this.logger.error(
				'createDashboardLogView: failed to create dashboard log view',
				error as Error
			);
			return err('Failed to create dashboard log view.');
		}
	}

	async updateDashboardLogView(
		input: z.infer<typeof updateDashboardLogViewInputSchema>,
		context: { userId: string; appId: string }
	) {
		this.logger.info('updateDashboardLogView: updating dashboard log view', { input, context });

		const validated = updateDashboardLogViewInputSchema.safeParse(input);
		if (!validated.success) {
			return err(validated.error.message);
		}

		try {
			const existing = await this.db.query.dashboardLogView.findFirst({
				where: and(
					eq(dashboardLogView.id, validated.data.id),
					eq(dashboardLogView.appId, context.appId)
				)
			});

			if (!existing) {
				return err('Dashboard log view not found.');
			}

			await this.db
				.update(dashboardLogView)
				.set({
					name: validated.data.name,
					definition: validated.data.definition,
					updatedBy: context.userId
				})
				.where(eq(dashboardLogView.id, existing.id));

			return ok(undefined);
		} catch (error) {
			this.logger.error(
				'updateDashboardLogView: failed to update dashboard log view',
				error as Error
			);
			return err('Failed to update dashboard log view.');
		}
	}

	async deleteDashboardLogView(id: string, context: { appId: string }) {
		this.logger.info('deleteDashboardLogView: deleting dashboard log view', { id, context });

		const validated = deleteDashboardLogViewInputSchema.safeParse(id);
		if (!validated.success) {
			return err(validated.error.message);
		}

		try {
			await this.db
				.delete(dashboardLogView)
				.where(
					and(
						eq(dashboardLogView.id, validated.data),
						eq(dashboardLogView.appId, context.appId)
					)
				);

			return ok(undefined);
		} catch (error) {
			this.logger.error(
				'deleteDashboardLogView: failed to delete dashboard log view',
				error as Error
			);
			return err('Failed to delete dashboard log view.');
		}
	}

	private async createUniqueSlug(name: string, appId: string) {
		const baseSlug = slugify(name);
		let slug = baseSlug;

		for (let attempt = 0; attempt < 21; attempt += 1) {
			const existing = await this.db.query.dashboardLogView.findFirst({
				where: and(
					eq(dashboardLogView.appId, appId),
					eq(dashboardLogView.slug, slug)
				)
			});

			if (!existing) {
				return slug;
			}

			slug = `${baseSlug}-${generateRandomString(3)}`;
		}

		throw new Error('Failed to generate unique slug for dashboard log view');
	}
}

const dashboardLogViewDefinitionSchema = z.object({
	version: z.literal(1).default(1),
	query: logsQueryFiltersSchema,
	display: z
		.object({
			columns: z.array(z.string()).default([]),
			sort: z
				.object({
					field: z.string().trim().min(1).max(100).default('timestamp'),
					direction: z.enum(['asc', 'desc']).default('desc')
				})
				.default({ field: 'timestamp', direction: 'desc' }),
			live: z.boolean().default(false)
		})
		.default({
			columns: [],
			sort: { field: 'timestamp', direction: 'desc' },
			live: false
		})
});

const createDashboardLogViewInputSchema = z.object({
	name: z.string().trim().min(1).max(32),
	definition: dashboardLogViewDefinitionSchema
});

const updateDashboardLogViewInputSchema = z.object({
	id: z.string().trim().min(1),
	name: z.string().trim().min(1).max(32),
	definition: dashboardLogViewDefinitionSchema
});

const deleteDashboardLogViewInputSchema = z.string().trim().min(1);

export {
	createDashboardLogViewInputSchema,
	DashboardLogViewService,
	deleteDashboardLogViewInputSchema,
	updateDashboardLogViewInputSchema
};
