import { updateDeploymentInputSchema } from '$lib/server/services/deployment.service';
import { json, type RequestHandler } from '@sveltejs/kit';

export const PATCH = (async ({ locals, params, request }) => {
	const key = extractBearerToken(request.headers.get('authorization'));
	if (!key) {
		return json({ error: 'Missing deployment API key.' }, { status: 401 });
	}

	const keyResult = await locals.container.deploymentService.resolvePrivateIngestionKey({ key });
	if (!keyResult.success) {
		return json({ error: keyResult.error }, { status: 401 });
	}

	const body = await request.json().catch(() => null);
	const input = updateDeploymentInputSchema.safeParse({
		...(typeof body === 'object' && body !== null ? body : {}),
		id: params.deployment_id
	});
	if (!input.success) {
		return json({ error: input.error.message }, { status: 400 });
	}

	const result = await locals.container.deploymentService.updateDeployment(input.data, {
		appId: keyResult.data.appId
	});

	if (!result.success) {
		return json({ error: result.error }, { status: result.error === 'Deployment not found.' ? 404 : 400 });
	}

	return json({ ok: true });
}) satisfies RequestHandler;

const extractBearerToken = (authorization: string | null) => {
	const prefix = 'Bearer ';
	if (!authorization?.startsWith(prefix)) {
		return null;
	}

	return authorization.slice(prefix.length).trim() || null;
};
