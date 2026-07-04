import { error } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import {
  getAllDocs,
  getDocByPath,
  getDocsSidebarGroups,
  renderDocPage,
  resolveDocReference
} from '$lib/docs';

const prerender = true;

const entries = () =>
  getAllDocs().map((doc) => ({
    category: doc.categorySlug,
    page: doc.slug
  }));

const load = (async ({ params }) => {
  const docs = getAllDocs();
  const doc = getDocByPath(params.category, params.page);

  if (!doc) {
    throw error(404, 'Doc not found');
  }

  const { content, toc } = await renderDocPage(doc.sourcePath);

  return {
    doc,
    content,
    toc,
    groups: getDocsSidebarGroups(docs),
    previousDoc: resolveDocReference(doc.previous, docs),
    nextDoc: resolveDocReference(doc.next, docs)
  };
}) satisfies PageServerLoad;

export { entries, load, prerender };
