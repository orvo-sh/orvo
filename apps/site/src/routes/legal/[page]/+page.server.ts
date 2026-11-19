import { legalDocuments } from '$lib/server/legal';
import { slugify } from '$lib/utils/slugify';
import { error } from '@sveltejs/kit';
import { Marked, Renderer } from 'marked';

import type { PageServerLoad } from './$types';

const load: PageServerLoad = async ({ params }) => {
  const document = legalDocuments.find(({ slug }) => slug === params.page);
  if (!document) error(404, 'Page not found');

  const renderer = new Renderer();
  renderer.heading = ({ depth, text }) => `<h${depth} id="${slugify(text)}">${text}</h${depth}>`;

  return {
    title: document.title,
    description: document.description,
    draft: document.draft ?? false,
    content: await new Marked({ renderer }).parse(document.content),
    documents: legalDocuments.map(({ slug, title }) => ({
      slug,
      title
    }))
  };
};

const entries = () => legalDocuments.map(({ slug }) => ({ page: slug }));

export { load, entries };
