import type { Logger } from '$lib/server/observability/logger';
import { genId } from '$lib/utils/gen-id';
import { and, desc, eq, isNull, type DB } from '@repo/db';
import { ingestionKey } from '@repo/db/schema';
import { z } from 'zod';
import { err, ok } from '../../utils/result';

class IngestionKeyService {
	private logger: Logger;

	constructor(
		private db: DB,
		logger: Logger
	) {
		this.logger = logger.child('IngestionKeyService');
	}

	async getIngestionKey(
		input: z.infer<typeof getIngestionKeyInputSchema>,
		context: { organizationId: string }
	) {
		this.logger.info('getIngestionKey: getting ingestion key', { input, context });

		const validated = getIngestionKeyInputSchema.safeParse(input);
		if (!validated.success) {
			return err(validated.error.message);
		}

		try {
			const key = await this.db.query.ingestionKey.findFirst({
				where: and(
					eq(ingestionKey.organizationId, context.organizationId),
					eq(ingestionKey.kind, validated.data.kind),
					isNull(ingestionKey.revokedAt)
				),
				orderBy: [desc(ingestionKey.createdAt)]
			});

			return ok({ key: key ?? null });
		} catch (error) {
			this.logger.error('getIngestionKey: failed to get ingestion key', error as Error);
			return err('Failed to get ingestion key.');
		}
	}

	async createIngestionKey(
		input: z.infer<typeof createIngestionKeyInputSchema>,
		context: { organizationId: string; userId: string }
	) {
		this.logger.info('createIngestionKey: creating ingestion key', { input, context });

		const validated = createIngestionKeyInputSchema.safeParse(input);
		if (!validated.success) {
			return err(validated.error.message);
		}

		try {
			const activeKey = await this.db.query.ingestionKey.findFirst({
				where: and(
					eq(ingestionKey.organizationId, context.organizationId),
					eq(ingestionKey.kind, validated.data.kind),
					isNull(ingestionKey.revokedAt)
				)
			});

			if (activeKey) {
				return ok({ id: activeKey.id, key: activeKey.key });
			}

			const key = genId(validated.data.kind === 'public' ? 'pk' : 'sk');
			const id = genId('ingk');

			await this.db
				.insert(ingestionKey)
				.values({
					id,
					organizationId: context.organizationId,
					kind: validated.data.kind,
					key,
					createdBy: context.userId
				})
				.execute();

			return ok({ id, key });
		} catch (error) {
			this.logger.error('createIngestionKey: failed to create ingestion key', error as Error);
			return err('Failed to create ingestion key.');
		}
	}

	async rotateIngestionKey(
		input: z.infer<typeof rotateIngestionKeyInputSchema>,
		context: { organizationId: string; userId: string }
	) {
		this.logger.info('rotateIngestionKey: rotating ingestion key', { input, context });

		const validated = rotateIngestionKeyInputSchema.safeParse(input);
		if (!validated.success) {
			return err(validated.error.message);
		}

		try {
			const activeKey = await this.db.query.ingestionKey.findFirst({
				where: and(
					eq(ingestionKey.organizationId, context.organizationId),
					eq(ingestionKey.kind, validated.data.kind),
					isNull(ingestionKey.revokedAt)
				)
			});

			if (activeKey) {
				await this.db
					.update(ingestionKey)
					.set({ revokedAt: new Date() })
					.where(eq(ingestionKey.id, activeKey.id))
					.execute();
			}

			const key = genId(validated.data.kind === 'public' ? 'pk' : 'sk');
			const id = genId('ingk');

			await this.db
				.insert(ingestionKey)
				.values({
					id,
					organizationId: context.organizationId,
					kind: validated.data.kind,
					key,
					createdBy: context.userId
				})
				.execute();

			return ok({ id, key });
		} catch (error) {
			this.logger.error('rotateIngestionKey: failed to rotate ingestion key', error as Error);
			return err('Failed to rotate ingestion key.');
		}
	}
}

const ingestionKeyKindSchema = z.enum(['public', 'private']);

const getIngestionKeyInputSchema = z.object({
	kind: ingestionKeyKindSchema
});

const createIngestionKeyInputSchema = z.object({
	kind: ingestionKeyKindSchema
});

const rotateIngestionKeyInputSchema = z.object({
	kind: ingestionKeyKindSchema
});

export {
	createIngestionKeyInputSchema,
	getIngestionKeyInputSchema,
	IngestionKeyService,
	rotateIngestionKeyInputSchema
};
