const coerceFrontMatterValue = (value: string) => {
  const normalized = value.trim();

  if (
    (normalized.startsWith('"') && normalized.endsWith('"')) ||
    (normalized.startsWith("'") && normalized.endsWith("'"))
  ) {
    return normalized.slice(1, -1);
  }

  if (/^-?\d+$/.test(normalized)) {
    return Number(normalized);
  }

  if (normalized === 'true') {
    return true;
  }

  if (normalized === 'false') {
    return false;
  }

  return normalized;
};

const parseFrontMatter = <T>(input: string) => {
  const frontMatterMatch = input.match(/^---\s*\r?\n([\s\S]*?)\r?\n---\s*(\r?\n|$)/);

  if (!frontMatterMatch) {
    return { meta: {}, content: input } as { meta: T; content: string };
  }

  const metaLines = frontMatterMatch[1].split(/\r?\n/);
  const metaEntries = metaLines
    .map((line) => line.trim())
    .filter((line) => line.length > 0)
    .map((line) => {
      const colonIndex = line.indexOf(':');

      if (colonIndex === -1) {
        return [line, ''];
      }

      const key = line.slice(0, colonIndex).trim();
      const value = line.slice(colonIndex + 1).trim();

      return [key, coerceFrontMatterValue(value)];
    })
    .filter(([key]) => String(key).length > 0);

  const meta = Object.fromEntries(metaEntries);
  const content = input.slice(frontMatterMatch[0].length);

  return { meta, content } as { meta: T; content: string };
};

export { parseFrontMatter };
