import { parseFrontMatter } from '$lib/utils/parse-front-matter';
import { slugify } from '$lib/utils/slugify';
import { error } from '@sveltejs/kit';
import hljs from 'highlight.js';
import { Marked, Renderer } from 'marked';
import { markedHighlight } from 'marked-highlight';

import { createMarkedCalloutExtension } from '../../_components/marked-callout-extension';

export const load = (async ({ params }) => {
  const doc = docs.find(({ key }) => key === `${params.category}/${params.page}`);
  if (!doc) throw error(404, "Page not found")

  const toc: {
    level: number;
    text: string;
    slug: string;
  }[] = [];
  const marked = new Marked(
    markedHighlight({
      emptyLangClass: 'hljs',
      langPrefix: 'hljs language-',
      highlight(code: string, lang: string) {
        const language = hljs.getLanguage(lang) ? lang : 'plaintext';
        return hljs.highlight(code, { language }).value;
      }
    })
  );

  marked.use({
    extensions: [createMarkedCalloutExtension()]
  });

  const renderer = new Renderer();

  renderer.heading = ({ depth, text }) => {
    const id = slugify(text);
    toc.push({ level: depth, text, slug: id });
    return `<h${depth} data-track id="${id}">${text}</h${depth}>`;
  };

  const html = await marked.parse(doc.content, { renderer });

  return {
    content: html,
    toc,
    title: doc.title,
    description: doc.description,
    category: params.category.replaceAll("-", " "),
    groups: (() => {
      const groups = new Map<string, {
        label: string;
        docs: { title: string, href: string }[]
      }>();
      for (const doc of docs) {
        const category = doc.key.split("/")[0];
        if (!groups.has(doc.key.split("/")[0])) {
          groups.set(doc.key.split("/")[0], {
            label: category.replaceAll("-", " "),
            docs: []
          })
        }
        groups.get(doc.key.split("/")[0])?.docs.push({
          href: `/docs/${doc.key}`,
          title: doc.title
        })
      }

      return [...groups.entries()]
        .sort(([left], [right]) => categoryRank(left) - categoryRank(right))
        .map(([, group]) => group);

    })(),
    previous: resolveAdjacentDoc(doc.previous),
    next: resolveAdjacentDoc(doc.next)
  };
});

export const entries = () =>
  docs.map(({ key }) => ({
    category: key.split("/")[0],
    page: key.split("/")[1],
  }))

const CATEGORY_ORDER = [
  'getting-started',
  'concepts',
  'product',
  'opentelemetry',
  'guides',
  'integrations',
  'reference'
];

const resolveAdjacentDoc = (reference?: string) => {
  if (!reference || reference === 'undefined') return null;
  const adjacentDoc = docs.find(({ key }) => key === reference);
  if (!adjacentDoc) return null;
  return {
    href: `/docs/${adjacentDoc.key}`,
    title: adjacentDoc.title
  };
};

const categoryRank = (category: string) => {
  const index = CATEGORY_ORDER.indexOf(category);
  return index === -1 ? CATEGORY_ORDER.length : index;
};

const docs = Object.entries(import.meta.glob('/content/docs/**/*.md', {
  query: '?raw',
  import: 'default',
  eager: true
}) as Record<string, string>).map(([key, source]) => {
  const { meta, content } = parseFrontMatter<{
    title: string;
    description: string;
    order: number;
    previous?: string;
    next?: string;
  }>(source);
  return {
    key: key.replace(/^\/content\/docs\//, "").replace(/\.md$/, ""),
    content: content,
    ...meta
  }
}).sort((left, right) => {
  if (left.order !== right.order) return left.order - right.order;
  if (left.key !== right.key) {
    return left.key.localeCompare(right.key);
  }
  return left.title.localeCompare(right.title);
});
