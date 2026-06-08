import type { DB } from '@repo/db';
import { assistantChat, assistantMessage } from '@repo/db/schema';
import type { Logger } from '@repo/logger';
import { err, genId, ok } from '@repo/utils';
import type { UIMessage } from 'ai';
import { and, asc, desc, eq } from 'drizzle-orm';
import { z } from 'zod';

class ChatService {
	private logger: Logger;

	constructor(
		private db: DB,
		logger: Logger
	) {
		this.logger = logger.child('ChatService');
	}

	async listChats(
		input: z.infer<typeof listAssistantChatsInputSchema>,
		context: { organizationId: string; appId: string; userId: string }
	) {
		this.logger.info('listChats: listing chats', { input, context });

		const validated = listAssistantChatsInputSchema.safeParse(input);
		if (!validated.success) {
			return err(validated.error.message);
		}

		try {
			const chats = await this.db.query.assistantChat.findMany({
				where: and(
					eq(assistantChat.organizationId, context.organizationId),
					eq(assistantChat.appId, context.appId),
					eq(assistantChat.createdBy, context.userId)
				),
				orderBy: [desc(assistantChat.updatedAt)],
				limit: validated.data.limit
			});

			return ok({ chats });
		} catch (error) {
			this.logger.error('listChats: failed to list chats', error as Error);
			return err('Failed to load chats.');
		}
	}

	async getChat(
		input: z.infer<typeof getAssistantChatInputSchema>,
		context: { organizationId: string; appId: string; userId: string }
	) {
		this.logger.info('getChat: getting chat', { input, context });

		const validated = getAssistantChatInputSchema.safeParse(input);
		if (!validated.success) {
			return err(validated.error.message);
		}

		try {
			const chat = await this.db.query.assistantChat.findFirst({
				where: and(
					eq(assistantChat.id, validated.data.id),
					eq(assistantChat.organizationId, context.organizationId),
					eq(assistantChat.appId, context.appId),
					eq(assistantChat.createdBy, context.userId)
				)
			});

			if (!chat) {
				return err('Chat not found.');
			}

			const messages = await this.db.query.assistantMessage.findMany({
				where: eq(assistantMessage.chatId, chat.id),
				orderBy: [asc(assistantMessage.position), asc(assistantMessage.createdAt)]
			});

			return ok({
				chat,
				messages: messages.map((message) => ({
					id: message.id,
					role: message.role as UIMessage['role'],
					parts: message.parts as UIMessage['parts'],
					metadata: message.metadata ?? undefined
				}))
			});
		} catch (error) {
			this.logger.error('getChat: failed to get chat', error as Error);
			return err('Failed to load chat.');
		}
	}

	async createChat(
		input: z.infer<typeof createAssistantChatInputSchema>,
		context: { organizationId: string; appId: string; userId: string }
	) {
		this.logger.info('createChat: creating chat', { input, context });

		const validated = createAssistantChatInputSchema.safeParse(input);
		if (!validated.success) {
			return err(validated.error.message);
		}

		try {
			const id = genId('chat');

			await this.db.insert(assistantChat).values({
				id,
				organizationId: context.organizationId,
				appId: context.appId,
				title: validated.data.title ?? 'New chat',
				createdBy: context.userId,
				updatedBy: context.userId
			});

			return ok({ id });
		} catch (error) {
			this.logger.error('createChat: failed to create chat', error as Error);
			return err('Failed to create chat.');
		}
	}

	async renameChat(
		input: z.infer<typeof renameAssistantChatInputSchema>,
		context: { organizationId: string; appId: string; userId: string }
	) {
		this.logger.info('renameChat: renaming chat', { input, context });

		const validated = renameAssistantChatInputSchema.safeParse(input);
		if (!validated.success) {
			return err(validated.error.message);
		}

		try {
			const existing = await this.db.query.assistantChat.findFirst({
				where: and(
					eq(assistantChat.id, validated.data.id),
					eq(assistantChat.organizationId, context.organizationId),
					eq(assistantChat.appId, context.appId),
					eq(assistantChat.createdBy, context.userId)
				)
			});

			if (!existing) {
				return err('Chat not found.');
			}

			await this.db
				.update(assistantChat)
				.set({
					title: validated.data.title,
					updatedBy: context.userId
				})
				.where(eq(assistantChat.id, existing.id));

			return ok(undefined);
		} catch (error) {
			this.logger.error('renameChat: failed to rename chat', error as Error);
			return err('Failed to rename chat.');
		}
	}

	async deleteChat(
		input: z.infer<typeof deleteAssistantChatInputSchema>,
		context: { organizationId: string; appId: string; userId: string }
	) {
		this.logger.info('deleteChat: deleting chat', { input, context });

		const validated = deleteAssistantChatInputSchema.safeParse(input);
		if (!validated.success) {
			return err(validated.error.message);
		}

		try {
			const existing = await this.db.query.assistantChat.findFirst({
				where: and(
					eq(assistantChat.id, validated.data.id),
					eq(assistantChat.organizationId, context.organizationId),
					eq(assistantChat.appId, context.appId),
					eq(assistantChat.createdBy, context.userId)
				)
			});

			if (!existing) {
				return err('Chat not found.');
			}

			await this.db.delete(assistantChat).where(eq(assistantChat.id, existing.id));

			return ok(undefined);
		} catch (error) {
			this.logger.error('deleteChat: failed to delete chat', error as Error);
			return err('Failed to delete chat.');
		}
	}

	async ensureChat(
		input: z.infer<typeof ensureAssistantChatInputSchema>,
		context: { organizationId: string; appId: string; userId: string }
	) {
		this.logger.info('ensureChat: ensuring chat', { input, context });

		const validated = ensureAssistantChatInputSchema.safeParse(input);
		if (!validated.success) {
			return err(validated.error.message);
		}

		try {
			const existing = await this.db.query.assistantChat.findFirst({
				where: and(
					eq(assistantChat.id, validated.data.id),
					eq(assistantChat.organizationId, context.organizationId),
					eq(assistantChat.appId, context.appId),
					eq(assistantChat.createdBy, context.userId)
				)
			});

			if (existing) {
				return ok({ chat: existing });
			}

			const title = deriveChatTitle(validated.data.firstUserMessage ?? '');

			await this.db.insert(assistantChat).values({
				id: validated.data.id,
				organizationId: context.organizationId,
				appId: context.appId,
				title,
				createdBy: context.userId,
				updatedBy: context.userId
			});

			const chat = await this.db.query.assistantChat.findFirst({
				where: eq(assistantChat.id, validated.data.id)
			});

			return ok({ chat: chat! });
		} catch (error) {
			this.logger.error('ensureChat: failed to ensure chat', error as Error);
			return err('Failed to prepare chat.');
		}
	}

	async saveMessages(
		input: z.infer<typeof saveAssistantMessagesInputSchema>,
		context: { organizationId: string; appId: string; userId: string }
	) {
		this.logger.info('saveMessages: saving messages', {
			chatId: input.chatId,
			messageCount: input.messages.length,
			context
		});

		const validated = saveAssistantMessagesInputSchema.safeParse(input);
		if (!validated.success) {
			return err(validated.error.message);
		}

		try {
			const existing = await this.db.query.assistantChat.findFirst({
				where: and(
					eq(assistantChat.id, validated.data.chatId),
					eq(assistantChat.organizationId, context.organizationId),
					eq(assistantChat.appId, context.appId),
					eq(assistantChat.createdBy, context.userId)
				)
			});

			if (!existing) {
				return err('Chat not found.');
			}

			const firstUserMessage = validated.data.messages.find((message) => message.role === 'user');
			const title =
				isGenericChatTitle(existing.title) && firstUserMessage
					? deriveChatTitle(extractText(firstUserMessage.parts))
					: existing.title;

			await this.db.transaction(async (tx) => {
				await tx.delete(assistantMessage).where(eq(assistantMessage.chatId, existing.id));

				if (validated.data.messages.length > 0) {
					await tx.insert(assistantMessage).values(
						validated.data.messages.map((message, position) => ({
							id: message.id,
							chatId: existing.id,
							position,
							role: message.role,
							content: extractText(message.parts),
							parts: serializeParts(message.parts),
							metadata: serializeMetadata(message.metadata)
						}))
					);
				}

				await tx
					.update(assistantChat)
					.set({
						title,
						updatedBy: context.userId,
						updatedAt: new Date()
					})
					.where(eq(assistantChat.id, existing.id));
			});

			return ok(undefined);
		} catch (error) {
			this.logger.error('saveMessages: failed to save messages', error as Error);
			return err('Failed to save chat messages.');
		}
	}
}

const assistantMessagePartSchema = z.record(z.string(), z.unknown());

const assistantUiMessageSchema = z.object({
	id: z.string().trim().min(1).max(255),
	role: z.enum(['system', 'user', 'assistant']),
	parts: z.array(assistantMessagePartSchema).default([]),
	metadata: z.unknown().optional()
});

const createAssistantChatInputSchema = z.object({
	title: z.string().trim().min(1).max(80).optional()
});

const listAssistantChatsInputSchema = z.object({
	limit: z.number().int().min(1).max(50).default(25)
});

const getAssistantChatInputSchema = z.object({
	id: z.string().trim().min(1).max(255)
});

const renameAssistantChatInputSchema = z.object({
	id: z.string().trim().min(1).max(255),
	title: z.string().trim().min(1).max(80)
});

const deleteAssistantChatInputSchema = z.object({
	id: z.string().trim().min(1).max(255)
});

const ensureAssistantChatInputSchema = z.object({
	id: z.string().trim().min(1).max(255),
	firstUserMessage: z.string().trim().max(1000).optional()
});

const saveAssistantMessagesInputSchema = z.object({
	chatId: z.string().trim().min(1).max(255),
	messages: z.array(assistantUiMessageSchema).max(100)
});

const extractText = (parts: Array<Record<string, unknown>>) =>
	parts
		.map((part) => {
			if (part.type !== 'text') {
				return '';
			}

			return typeof part.text === 'string' ? part.text : '';
		})
		.join('\n')
		.trim();

const deriveChatTitle = (message: string) => {
	const normalized = message.replace(/\s+/g, ' ').trim();

	if (!normalized) {
		return 'New chat';
	}

	return normalized.length <= 64 ? normalized : `${normalized.slice(0, 61)}...`;
};

const isGenericChatTitle = (title: string) => {
	const normalized = title.trim().toLowerCase();
	return normalized === '' || normalized === 'new chat' || normalized === 'chat';
};

const serializeParts = (parts: Array<Record<string, unknown>>) =>
	JSON.parse(JSON.stringify(parts)) as Array<Record<string, unknown>>;

const serializeMetadata = (metadata: unknown) => {
	if (metadata === undefined || metadata === null) {
		return null;
	}

	return JSON.parse(JSON.stringify(metadata)) as Record<string, unknown>;
};

export {
	ChatService,
	createAssistantChatInputSchema,
	deleteAssistantChatInputSchema,
	deriveChatTitle,
	ensureAssistantChatInputSchema,
	getAssistantChatInputSchema,
	listAssistantChatsInputSchema,
	renameAssistantChatInputSchema,
	saveAssistantMessagesInputSchema
};
