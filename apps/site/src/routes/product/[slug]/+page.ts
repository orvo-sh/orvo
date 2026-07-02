import { error } from '@sveltejs/kit';
import type { PageLoad } from './$types';
import { productFeatureByPath } from '$lib/product-features';

const load: PageLoad = ({ params }) => {
  const feature = productFeatureByPath[`/product/${params.slug}`];

  if (!feature) {
    error(404, 'Product feature not found');
  }

  return { feature };
};

export { load };
