import { redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import { getAllDocs } from '$lib/docs';

const load = (() => {
  const firstDoc = getAllDocs()[0];

  if (!firstDoc) {
    throw redirect(302, '/');
  }

  throw redirect(302, firstDoc.href);
}) satisfies PageServerLoad;

export { load };
