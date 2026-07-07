import { parseFrontMatter } from '$lib/utils/parse-front-matter';
import { slugify } from '$lib/utils/slugify';
import { error } from '@sveltejs/kit';
import InfoCircle from '@tabler/icons-svelte/icons/info-circle';
import hljs from 'highlight.js';
import { Marked, Renderer } from 'marked';
import { markedHighlight } from 'marked-highlight';
import { render } from 'svelte/server';

import type { PageServerLoad } from './$types';

const CATEGORY_ORDER = [
  'getting-started',
  'concepts',
  'opentelemetry',
  'product',
  'guides',
  'integrations',
  'reference'
];

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

const entries = () =>
  docs.map(({ key }) => ({
    category: key.split("/")[0],
    page: key.split("/")[1],
  }))

const resolveAdjacentDoc = (reference?: string) => {
  if (!reference || reference === 'undefined') return null;

  const adjacentDoc = docs.find(({ key }) => key === reference);

  if (!adjacentDoc) return null;

  return {
    href: `/docs/${adjacentDoc.key}`,
    title: adjacentDoc.title
  };
};

const load = (async ({ params }) => {
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
    extensions: [{
      name: 'callout',
      level: 'block',
      start(src) {
        return src.indexOf(':::');
      },
      tokenizer(src) {
        const match = /^:::(\w+)\n([\s\S]*?)\n:::/.exec(src);

        if (match) {
          return {
            type: 'callout',
            raw: match[0],
            kind: ['info'].includes(match[1]) ? match[1] : 'info',
            content: this.lexer.blockTokens(match[2])
          };
        }
      },
      renderer(token) {
        return `<div class="callout callout-${token.kind}">
        <span class="callout-icon">${render(InfoCircle).body}</span>
        <div class="callout-content">${this.parser.parse(token.content)}</div>
      </div>`;
      }
    }]
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
    groups: (() => {
      const groups = new Map<string, {
        label: string;
        docs: { title: string, href: string }[]
      }>();
      for (const doc of docs) {
        if (!groups.has(doc.key.split("/")[0])) {
          groups.set(doc.key.split("/")[0], {
            label: doc.key.split("/")[0].replace("-", " ").toLocaleUpperCase(),
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
}) satisfies PageServerLoad;


export {
  entries,
  load
};


