import { getAllDocs } from '$lib/docs';
import { redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';

const prerender = true;

const load = (() => {
  const firstDoc = getAllDocs()[0];

  if (!firstDoc) {
    throw redirect(302, '/');
  }

  throw redirect(302, firstDoc.href);
}) satisfies PageServerLoad;

export { load, prerender };
