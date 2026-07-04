import hljs from 'highlight.js';
import { Marked, Renderer } from 'marked';
import { markedHighlight } from 'marked-highlight';
import { slugify } from '$lib/slugify';
import { createMarkedCalloutExtension } from './marked-callout-extension';
import { parseFrontMatter } from './parse-front-matter';

type DocFrontMatter = {
  title?: string;
  description?: string;
  category?: string;
  order?: number | string;
  slug?: string;
  previous?: string;
  next?: string;
};

type DocPage = {
  title: string;
  description: string;
  category: string;
  categorySlug: string;
  order: number;
  slug: string;
  href: string;
  previous?: string;
  next?: string;
  sourcePath: string;
  source: string;
};

type TocItem = {
  level: number;
  text: string;
  slug: string;
};

const docSources = import.meta.glob('/src/routes/docs/_pages/*.md', {
  query: '?raw',
  import: 'default',
  eager: true
}) as Record<string, string>;

const listDocSourcePaths = () => Object.keys(docSources).sort();

const getFallbackTitle = (sourcePath: string) =>
  sourcePath.split('/').at(-1)?.replace(/\.md$/, '').replace(/-/g, ' ') ?? 'Untitled';

const getDocPageFromSourcePath = (sourcePath: string) => {
  const source = docSources[sourcePath];

  if (!source) {
    throw new Error(`Missing doc source for "${sourcePath}".`);
  }

  const { meta } = parseFrontMatter<DocFrontMatter>(source);
  const fallbackTitle = getFallbackTitle(sourcePath);
  const title = meta.title?.trim() || fallbackTitle;
  const category = meta.category?.trim() || 'General';
  const slug = slugify(String(meta.slug ?? title));
  const categorySlug = slugify(category);
  const order = Number(meta.order ?? Number.MAX_SAFE_INTEGER);

  return {
    title,
    description: meta.description?.trim() || '',
    category,
    categorySlug,
    order,
    slug,
    href: `/docs/${categorySlug}/${slug}`,
    previous: typeof meta.previous === 'string' ? meta.previous.trim() : undefined,
    next: typeof meta.next === 'string' ? meta.next.trim() : undefined,
    sourcePath,
    source
  } satisfies DocPage;
};

const getAllDocs = () =>
  listDocSourcePaths()
    .map(getDocPageFromSourcePath)
    .sort((left, right) => {
      if (left.order !== right.order) return left.order - right.order;
      if (left.categorySlug !== right.categorySlug) {
        return left.categorySlug.localeCompare(right.categorySlug);
      }

      return left.title.localeCompare(right.title);
    });

const resolveDocReference = (reference: string | undefined, docs: DocPage[]) => {
  if (!reference) return null;

  const normalized = reference.replace(/^\/docs\//, '').trim();

  if (normalized.includes('/')) {
    const [categoryPart, pagePart] = normalized.split('/');
    const categorySlug = slugify(categoryPart);
    const pageSlug = slugify(pagePart);

    return docs.find((doc) => doc.categorySlug === categorySlug && doc.slug === pageSlug) ?? null;
  }

  const pageSlug = slugify(normalized);
  const matches = docs.filter((doc) => doc.slug === pageSlug);

  if (matches.length > 1) {
    throw new Error(`Ambiguous docs reference "${reference}". Use "category/page".`);
  }

  return matches[0] ?? null;
};

const getDocsSidebarGroups = (docs: DocPage[]) => {
  const groups = new Map<
    string,
    {
      label: string;
      slug: string;
      docs: DocPage[];
    }
  >();

  for (const doc of docs) {
    if (!groups.has(doc.categorySlug)) {
      groups.set(doc.categorySlug, {
        label: doc.category,
        slug: doc.categorySlug,
        docs: []
      });
    }

    groups.get(doc.categorySlug)?.docs.push(doc);
  }

  return [...groups.values()];
};

const getDocByPath = (categorySlug: string, pageSlug: string) =>
  getAllDocs().find((doc) => doc.categorySlug === categorySlug && doc.slug === pageSlug) ?? null;

const renderDocPage = async (sourcePath: string) => {
  const source = docSources[sourcePath];

  if (!source) {
    throw new Error(`Missing doc source for "${sourcePath}".`);
  }

  const { content } = parseFrontMatter<DocFrontMatter>(source);
  const toc: TocItem[] = [];
  const marked = new Marked(
    markedHighlight({
      emptyLangClass: 'hljs',
      langPrefix: 'hljs language-',
      highlight(code, lang) {
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

  const html = await marked.parse(content, { renderer });

  return {
    content: html,
    toc
  };
};

export { getAllDocs, getDocByPath, getDocsSidebarGroups, renderDocPage, resolveDocReference };
