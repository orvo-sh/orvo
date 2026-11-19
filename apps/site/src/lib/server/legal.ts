import { parseFrontMatter } from '$lib/utils/parse-front-matter';

const legalDocuments = Object.entries(
  import.meta.glob('/content/legal/*.md', {
    query: '?raw',
    import: 'default',
    eager: true
  }) as Record<string, string>
)
  .map(([path, source]) => {
    const { meta, content } = parseFrontMatter<{
      title: string;
      description: string;
      order: number;
      draft?: boolean;
    }>(source);

    return {
      ...meta,
      slug: path.replace('/content/legal/', '').replace(/\.md$/, ''),
      content
    };
  })
  .sort((left, right) => left.order - right.order || left.slug.localeCompare(right.slug));

export { legalDocuments };
