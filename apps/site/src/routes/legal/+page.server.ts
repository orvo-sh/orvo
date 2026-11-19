import { legalDocuments } from '$lib/server/legal';
import { error, redirect } from '@sveltejs/kit';

const load = () => {
  if (!legalDocuments.length) error(404, 'Page not found');
  redirect(307, `/legal/${legalDocuments[0].slug}`);
};

export { load };
