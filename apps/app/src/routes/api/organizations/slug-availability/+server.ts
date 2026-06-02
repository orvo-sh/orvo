import { env } from '$env/dynamic/private';
import { eq, getDb } from '@repo/db';
import { slugify } from '@repo/utils';
import * as dbSchema from '@repo/db/schema';
import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { isValidOrganizationSlug } from '$lib/organization-slug';

export const GET = (async ({ url }) => {
	const slug = slugify(url.searchParams.get('slug') ?? '');

	if (!slug || !isValidOrganizationSlug(slug)) {
		return json({ available: false });
	}

	const db = getDb(process.env.POSTGRES_URL ?? env.POSTGRES_URL);
	const existingOrganization = await db.query.organization.findFirst({
		columns: {
			id: true
		},
		where: eq(dbSchema.organization.slug, slug)
	});

	return json({
		available: !existingOrganization
	});
}) satisfies RequestHandler;
