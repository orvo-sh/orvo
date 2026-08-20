import type { LayoutServerLoad } from './$types';

export const prerender = false;

const CACHE_KEY = 'github-repository';
const CACHE_TTL = 1000 * 60 * 60;

let memoryCache: { githubStars: number; expiresAt: number } | null = null;

const load: LayoutServerLoad = async ({ fetch, platform }) => {
  const now = Date.now();
  let cachedRepository = memoryCache;

  try {
    const cached = await platform?.env.GITHUB_CACHE?.get(CACHE_KEY);
    const parsed = cached
      ? (JSON.parse(cached) as { githubStars?: unknown; expiresAt?: unknown })
      : null;

    if (
      parsed &&
      typeof parsed.githubStars === 'number' &&
      typeof parsed.expiresAt === 'number'
    ) {
      cachedRepository = {
        githubStars: parsed.githubStars,
        expiresAt: parsed.expiresAt
      };
      memoryCache = cachedRepository;
    }
  } catch {
    // Fall back to the last value held by this process when KV is unavailable.
  }

  if (cachedRepository && now < cachedRepository.expiresAt) {
    return {
      githubStars: cachedRepository.githubStars
    };
  }

  let githubStars = cachedRepository?.githubStars ?? 0;

  try {
    const response = await fetch('https://api.github.com/repos/orvo-sh/orvo', {
      headers: {
        Accept: 'application/vnd.github+json'
      }
    });

    if (!response.ok) throw new Error(`GitHub returned ${response.status}`);

    const repository = (await response.json()) as {
      stargazers_count?: number;
    };

    githubStars = repository.stargazers_count ?? githubStars;
  } catch {
    // Keep the last known value when GitHub is unavailable or rate limited.
  }

  const cacheValue = { githubStars, expiresAt: now + CACHE_TTL };

  memoryCache = cacheValue;

  try {
    await platform?.env.GITHUB_CACHE?.put(CACHE_KEY, JSON.stringify(cacheValue));
  } catch {
    // The fetched value is still valid for this request when KV cannot be written.
  }

  return {
    githubStars
  };
};

export { load };
