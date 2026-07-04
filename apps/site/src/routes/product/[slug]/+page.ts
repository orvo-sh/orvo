import { error } from '@sveltejs/kit';
import type { PageLoad } from './$types';
import { productFeatureByPath, productFeatures } from '$lib/product-features';

const entries = () =>
  productFeatures.map((feature) => ({
    slug: feature.href.replace('/product/', '')
  }));

const load: PageLoad = ({ params }) => {
  const feature = productFeatureByPath[`/product/${params.slug}`];

  if (!feature) {
    error(404, 'Product feature not found');
  }

  return { feature };
};

export { entries, load };
