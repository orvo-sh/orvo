import { randomBytes, randomUUID } from 'node:crypto';
import { ingestionKey, ingestionKeyKind } from '@repo/db/schema';
import type { DB } from '@repo/db';
import { and, desc, eq, isNull } from 'drizzle-orm';
import { z } from 'zod';
import type { Logger } from '$lib/server/observability/logger';
import { err, ok, type ServiceResult } from './result';

export const ingestionKeyKindSchema = z.enum(['public', 'private']);

export const getIngestionKeysInputSchema = z.object({
	includeRevoked: z.boolean().default(true)
});

export const createIngestionKeyInputSchema = z.object({
	kind: ingestionKeyKindSchema
});

export const revokeIngestionKeyInputSchema = z.object({
	ingestionKeyId: z.string().trim().min(1)
});

export type IngestionKeyRow = {
	id: string;
	kind: (typeof ingestionKeyKind.enumValues)[number];
	key: string;
	createdAt: string;
	lastUsedAt: string | null;
	revokedAt: string | null;
	createdBy: string | null;
};

const keyPrefixMap: Record<z.infer<typeof ingestionKeyKindSchema>, string> = {
	public: 'pk_',
	private: 'sk_'
};

const createRawIngestionKey = (kind: z.infer<typeof ingestionKeyKindSchema>) =>
	`${keyPrefixMap[kind]}${randomBytes(24).toString('base64url')}`;

class IngestionKeyService {
	private logger: Logger;

	constructor(
		private db: DB,
		logger: Logger
	) {
		this.logger = logger.child('IngestionKeyService');
	}

	async getIngestionKeys(
		organizationId: string,
		input: z.infer<typeof getIngestionKeysInputSchema>
	): Promise<ServiceResult<{ ingestionKeys: IngestionKeyRow[] }>> {
		this.logger.info('getIngestionKeys: getting ingestion keys', { organizationId, input });

		const validated = getIngestionKeysInputSchema.safeParse(input);
		if (!validated.success) {
			return err(validated.error.message);
		}

		try {
			const rows = await this.db.query.ingestionKey.findMany({
				where: validated.data.includeRevoked
					? eq(ingestionKey.organizationId, organizationId)
					: and(eq(ingestionKey.organizationId, organizationId), isNull(ingestionKey.revokedAt)),
				orderBy: [desc(ingestionKey.createdAt)]
			});

			return ok({
				ingestionKeys: rows.map((row) => ({
					id: row.id,
					kind: row.kind,
					key: row.key,
					createdAt: row.createdAt.toISOString(),
					lastUsedAt: row.lastUsedAt?.toISOString() ?? null,
					revokedAt: row.revokedAt?.toISOString() ?? null,
					createdBy: row.createdBy ?? null
				}))
			});
		} catch (error) {
			this.logger.error('getIngestionKeys: failed to get ingestion keys', error as Error);
			return err('Failed to get ingestion keys.');
		}
	}

	async createIngestionKey(
		organizationId: string,
		input: z.infer<typeof createIngestionKeyInputSchema>,
		context: { userId: string }
	): Promise<ServiceResult<{ ingestionKey: IngestionKeyRow }>> {
		this.logger.info('createIngestionKey: creating ingestion key', {
			organizationId,
			input,
			context
		});

		const validated = createIngestionKeyInputSchema.safeParse(input);
		if (!validated.success) {
			return err(validated.error.message);
		}

		try {
			const activeKey = await this.db.query.ingestionKey.findFirst({
				where: and(
					eq(ingestionKey.organizationId, organizationId),
					eq(ingestionKey.kind, validated.data.kind),
					isNull(ingestionKey.revokedAt)
				)
			});

			if (activeKey) {
				return err(
					`An active ${validated.data.kind} ingestion key already exists. Revoke it before creating another.`
				);
			}

			const createdAt = new Date();
			const row = {
				id: randomUUID(),
				organizationId,
				kind: validated.data.kind,
				key: createRawIngestionKey(validated.data.kind),
				createdBy: context.userId,
				createdAt
			};

			await this.db.insert(ingestionKey).values(row).execute();

			return ok({
				ingestionKey: {
					id: row.id,
					kind: row.kind,
					key: row.key,
					createdAt: createdAt.toISOString(),
					lastUsedAt: null,
					revokedAt: null,
					createdBy: row.createdBy
				}
			});
		} catch (error) {
			this.logger.error('createIngestionKey: failed to create ingestion key', error as Error);
			return err('Failed to create ingestion key.');
		}
	}

	async revokeIngestionKey(
		organizationId: string,
		input: z.infer<typeof revokeIngestionKeyInputSchema>
	): Promise<ServiceResult<void>> {
		this.logger.info('revokeIngestionKey: revoking ingestion key', { organizationId, input });

		const validated = revokeIngestionKeyInputSchema.safeParse(input);
		if (!validated.success) {
			return err(validated.error.message);
		}

		try {
			const row = await this.db.query.ingestionKey.findFirst({
				where: and(
					eq(ingestionKey.id, validated.data.ingestionKeyId),
					eq(ingestionKey.organizationId, organizationId)
				)
			});

			if (!row) {
				return err('Ingestion key not found.');
			}

			if (row.revokedAt) {
				return ok(undefined);
			}

			await this.db
				.update(ingestionKey)
				.set({
					revokedAt: new Date()
				})
				.where(eq(ingestionKey.id, row.id))
				.execute();

			return ok(undefined);
		} catch (error) {
			this.logger.error('revokeIngestionKey: failed to revoke ingestion key', error as Error);
			return err('Failed to revoke ingestion key.');
		}
	}
}

export { IngestionKeyService };
