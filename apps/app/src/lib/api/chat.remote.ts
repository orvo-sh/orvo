import { command, getRequestEvent, query } from '$app/server';
import { resolveRequestAppContext } from '$lib/server/request-context';
import {
	createAssistantChatInputSchema,
	deleteAssistantChatInputSchema,
	getAssistantChatInputSchema,
	listAssistantChatsInputSchema,
	renameAssistantChatInputSchema
} from '$lib/server/services/chat.service';
import { err } from '@repo/utils';

export const listAssistantChatsQuery = query(listAssistantChatsInputSchema, async (input) => {
	const event = getRequestEvent();
	const appContext = await resolveRequestAppContext(event);

	if (!appContext.success) {
		return err(appContext.error);
	}

	return event.locals.container.chatService.listChats(input, {
		organizationId: appContext.data.organizationId,
		appId: appContext.data.appId,
		userId: event.locals.auth!.user.id
	});
});

export const getAssistantChatQuery = query(getAssistantChatInputSchema, async (input) => {
	const event = getRequestEvent();
	const appContext = await resolveRequestAppContext(event);

	if (!appContext.success) {
		return err(appContext.error);
	}

	return event.locals.container.chatService.getChat(input, {
		organizationId: appContext.data.organizationId,
		appId: appContext.data.appId,
		userId: event.locals.auth!.user.id
	});
});

export const createAssistantChatCommand = command(createAssistantChatInputSchema, async (input) => {
	const event = getRequestEvent();
	const appContext = await resolveRequestAppContext(event);

	if (!appContext.success) {
		return err(appContext.error);
	}

	return event.locals.container.chatService.createChat(input, {
		organizationId: appContext.data.organizationId,
		appId: appContext.data.appId,
		userId: event.locals.auth!.user.id
	});
});

export const renameAssistantChatCommand = command(renameAssistantChatInputSchema, async (input) => {
	const event = getRequestEvent();
	const appContext = await resolveRequestAppContext(event);

	if (!appContext.success) {
		return err(appContext.error);
	}

	return event.locals.container.chatService.renameChat(input, {
		organizationId: appContext.data.organizationId,
		appId: appContext.data.appId,
		userId: event.locals.auth!.user.id
	});
});

export const deleteAssistantChatCommand = command(deleteAssistantChatInputSchema, async (input) => {
	const event = getRequestEvent();
	const appContext = await resolveRequestAppContext(event);

	if (!appContext.success) {
		return err(appContext.error);
	}

	return event.locals.container.chatService.deleteChat(input, {
		organizationId: appContext.data.organizationId,
		appId: appContext.data.appId,
		userId: event.locals.auth!.user.id
	});
});
