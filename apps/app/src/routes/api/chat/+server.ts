import { env } from '$env/dynamic/private';
import { getActiveOrganizationId } from '$lib/server/request-context';
import { buildOrvoAssistantSystemPrompt } from '$lib/server/services/chat-prompt';
import { createOrvoAssistantTools } from '$lib/server/services/chat-tools';
import { createGoogleGenerativeAI } from '@ai-sdk/google';
import { genId } from '@repo/utils';
import { error } from '@sveltejs/kit';
import {
	consumeStream,
	convertToModelMessages,
	streamText,
	stepCountIs,
	type UIMessage
} from 'ai';
import { z } from 'zod';

import type { RequestHandler } from './$types';

const uiMessagePartSchema = z.record(z.string(), z.unknown());

const uiMessageSchema = z.object({
	id: z.string().trim().min(1).max(255),
	role: z.enum(['system', 'user', 'assistant']),
	parts: z.array(uiMessagePartSchema).default([]),
	metadata: z.unknown().optional()
});

const chatRequestSchema = z
	.object({
		id: z.string().trim().min(1).max(255).optional(),
		chatId: z.string().trim().min(1).max(255).optional(),
		appId: z.string().trim().min(1).max(255),
		messages: z.array(uiMessageSchema).max(100)
	})
	.passthrough()
	.refine((value) => Boolean(value.chatId ?? value.id), {
		message: 'chatId is required'
	});

const firstUserMessageText = (messages: UIMessage[]) =>
	messages
		.find((message) => message.role === 'user')
		?.parts.map((part) => (part.type === 'text' ? part.text : ''))
		.join('\n')
		.trim() ?? '';

export const POST: RequestHandler = async (event) => {
	if (!event.locals.auth) {
		throw error(401, 'Sign in to use Ask Orvo.');
	}

	const organizationId = getActiveOrganizationId(event);
	if (!organizationId) {
		throw error(400, 'No active organization selected.');
	}

	const body = await event.request.json().catch(() => null);
	const validated = chatRequestSchema.safeParse(body);
	if (!validated.success) {
		throw error(400, validated.error.message);
	}

	const chatId = validated.data.chatId ?? validated.data.id!;
	const appResult = await event.locals.container.appService.getApp(
		{ id: validated.data.appId },
		{ organizationId }
	);

	if (!appResult.success) {
		throw error(404, appResult.error);
	}

	const apiKey = process.env.GEMINI_API_KEY ?? env.GEMINI_API_KEY;
	if (!apiKey) {
		throw error(503, 'Gemini API key is not configured.');
	}

	const messages = validated.data.messages as UIMessage[];
	const ensureResult = await event.locals.container.chatService.ensureChat(
		{
			id: chatId,
			firstUserMessage: firstUserMessageText(messages)
		},
		{
			organizationId,
			appId: appResult.data.app.id,
			userId: event.locals.auth.user.id
		}
	);

	if (!ensureResult.success) {
		throw error(400, ensureResult.error);
	}

	const google = createGoogleGenerativeAI({ apiKey });
	const tools = createOrvoAssistantTools({
		app: appResult.data.app,
		organizationId,
		appService: event.locals.container.appService,
		logsService: event.locals.container.logsService,
		tracesService: event.locals.container.tracesService,
		alertRuleService: event.locals.container.alertRuleService
	});
	const modelId = process.env.ORVO_CHAT_MODEL ?? env.ORVO_CHAT_MODEL ?? 'gemini-2.5-flash';
	const result = streamText({
		model: google(modelId),
		system: buildOrvoAssistantSystemPrompt({
			app: appResult.data.app,
			organization: undefined,
			now: new Date()
		}),
		messages: await convertToModelMessages(messages, {
			tools,
			ignoreIncompleteToolCalls: true
		}),
		tools,
		stopWhen: stepCountIs(5),
		temperature: 0.2
	});

	return result.toUIMessageStreamResponse({
		consumeSseStream: consumeStream,
		originalMessages: messages,
		generateMessageId: () => genId('msg'),
		onFinish: async ({ messages: finishedMessages, isAborted }) => {
			if (isAborted) {
				return;
			}

			const saveResult = await event.locals.container.chatService.saveMessages(
				{
					chatId,
					messages: finishedMessages
				},
				{
					organizationId,
					appId: appResult.data.app.id,
					userId: event.locals.auth!.user.id
				}
			);

			if (!saveResult.success) {
				console.error('Ask Orvo failed to save chat messages', saveResult.error);
			}
		},
		onError: (streamError) => {
			console.error('Ask Orvo stream failed', streamError);
			return 'Ask Orvo could not finish this response.';
		}
	});
};
