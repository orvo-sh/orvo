import type { Logger } from '$lib/server/observability/logger';
import { genId } from '$lib/utils/gen-id';
import { generateRandomString } from '$lib/utils/generate-random-string';
import { slugify } from '$lib/utils/slugify';
import { and, desc, eq, type DB } from '@repo/db';
import { dashboardLogView } from '@repo/db/schema';
import { z } from 'zod';
import { err, ok } from '../../utils/result';
import { logsQueryFiltersSchema } from './logs.service';

class DashboardService {
	private logger: Logger;

	constructor(
		private db: DB,
		logger: Logger
	) {
		this.logger = logger.child('DashboardService');
	}

	async getDashboardLogViews(context: { organizationId: string }) {
		this.logger.info('getDashboardLogViews: getting dashboard log views', {
			context
		});

		try {
			const dashboardLogViews = await this.db.query.dashboardLogView.findMany({
				where: eq(dashboardLogView.organizationId, context.organizationId),
				orderBy: [desc(dashboardLogView.name)]
			});

			return ok({
				dashboardLogViews
			});
		} catch (error) {
			this.logger.error(
				'getDashboardLogViews: failed to get dashboard log views',
				error as Error
			);
			return err('Failed to get dashboard log views.');
		}
	}

	async createDashboardLogView(
		input: z.infer<typeof createDashboardLogViewInputSchema>,
		context: { userId: string; organizationId: string }
	) {
		this.logger.info('createDashboardLogView: creating dashboard log view', {
			organizationId: context.organizationId,
			input,
			context
		});

		const validated = createDashboardLogViewInputSchema.safeParse(input);
		if (!validated.success) {
			return err(validated.error.message);
		}

		try {
			const baseSlug = slugify(validated.data.name);
			let slug = baseSlug;

			let existing = await this.db.query.dashboardLogView.findFirst({
				where: and(
					eq(dashboardLogView.organizationId, context.organizationId),
					eq(dashboardLogView.slug, baseSlug)
				)
			});

			if (existing) {
				slug = ""
				for (let i = 0; i < 20; i++) {
					const candidate = `${baseSlug}-${generateRandomString(3)}`;
					existing = await this.db.query.dashboardLogView.findFirst({
						where: and(
							eq(dashboardLogView.organizationId, context.organizationId),
							eq(dashboardLogView.slug, candidate)
						)
					});

					if (!existing) {
						slug = candidate;
						break;
					}
				}
				if (!slug) {
					throw new Error('Failed to generate unique slug for dashboard log view');
				}
			}

			const id = genId('logv');
			await this.db
				.insert(dashboardLogView)
				.values({
					id,
					organizationId: context.organizationId,
					slug,
					name: validated.data.name,
					definition: validated.data.definition,
					createdBy: context.userId,
					updatedBy: context.userId,
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
		context: { userId: string; organizationId: string }
	) {
		this.logger.info('updateDashboardLogView: updating dashboard log view', {
			input,
			context
		});

		const validated = updateDashboardLogViewInputSchema.safeParse(input);
		if (!validated.success) {
			return err(validated.error.message);
		}

		try {
			const existing = await this.db.query.dashboardLogView.findFirst({
				where: and(
					eq(dashboardLogView.id, validated.data.id),
					eq(dashboardLogView.organizationId, context.organizationId)
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
					updatedBy: context.userId,
				})
				.where(eq(dashboardLogView.id, existing.id))
				.returning();

			return ok(undefined);
		} catch (error) {
			this.logger.error(
				'updateDashboardLogView: failed to update dashboard log view',
				error as Error
			);
			return err('Failed to update dashboard log view.');
		}
	}

	async deleteDashboardLogView(
		id: string,
		context: { organizationId: string }
	) {
		this.logger.info('deleteDashboardLogView: deleting dashboard log view', {
			id,
			context
		});

		try {
			await this.db
				.delete(dashboardLogView)
				.where(and(eq(dashboardLogView.id, id), eq(dashboardLogView.organizationId, context.organizationId)))
				.execute();

			return ok(undefined);
		} catch (error) {
			this.logger.error(
				'deleteDashboardLogView: failed to delete dashboard log view',
				error as Error
			);
			return err('Failed to delete dashboard log view.');
		}
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
	name: z.string().min(1).max(32),
	definition: dashboardLogViewDefinitionSchema
});

const updateDashboardLogViewInputSchema = z.object({
	id: z.string().trim().min(1),
	name: z.string().min(1).max(32),
	definition: dashboardLogViewDefinitionSchema
});


export { createDashboardLogViewInputSchema, DashboardService, updateDashboardLogViewInputSchema };

