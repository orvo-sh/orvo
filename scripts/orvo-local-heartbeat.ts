#!/usr/bin/env -S pnpm --filter app exec vite-node

const usage = `
Usage:
  pnpm local:heartbeat -- --duration <duration> --url <url>

Examples:
  pnpm local:heartbeat -- --duration 30s --url http://localhost:4318/v1/heartbeats/hb_secret
  pnpm local:heartbeat -- 5m https://ingest.example.com/v1/heartbeats/hb_secret

Durations accept ms, s, m, h, or d. The script:
  1. sends an initial check-in
  2. sends another check-in after every duration
  3. continues until you press Ctrl+C

Options:
  --help  Show this help
`;

const parseDuration = (value: string | undefined, label: string) => {
  const match = value?.trim().match(/^(\d+(?:\.\d+)?)\s*(ms|s|m|h|d)$/i);

  if (!match) {
    throw new Error(`${label} must be a duration such as 500ms, 30s, 5m, 2h, or 1d.`);
  }

  const multipliers = {
    ms: 1,
    s: 1_000,
    m: 60_000,
    h: 3_600_000,
    d: 86_400_000
  };

  return Number(match[1]) * multipliers[match[2].toLowerCase() as keyof typeof multipliers];
};

const formatDuration = (milliseconds: number) => {
  if (milliseconds < 1_000) return `${milliseconds}ms`;
  if (milliseconds < 60_000) return `${milliseconds / 1_000}s`;
  if (milliseconds < 3_600_000) return `${milliseconds / 60_000}m`;
  if (milliseconds < 86_400_000) return `${milliseconds / 3_600_000}h`;
  return `${milliseconds / 86_400_000}d`;
};

const sleep = (milliseconds: number, signal: AbortSignal) =>
  new Promise<void>((resolve, reject) => {
    const onAbort = () => {
      clearTimeout(timeout);
      reject(signal.reason);
    };
    const timeout = setTimeout(() => {
      signal.removeEventListener('abort', onAbort);
      resolve();
    }, milliseconds);

    if (signal.aborted) {
      onAbort();
      return;
    }

    signal.addEventListener('abort', onAbort, { once: true });
  });

const readArguments = () => {
  const values = new Map<string, string>();
  const positional: string[] = [];
  const args = process.argv.slice(2);

  for (let index = 0; index < args.length; index += 1) {
    const argument = args[index];

    if (argument === '--') {
      continue;
    }

    if (argument === '--help' || argument === '-h') {
      console.log(usage.trim());
      process.exit(0);
    }

    if (argument.startsWith('--')) {
      const [name, inlineValue] = argument.slice(2).split('=', 2);
      const value = inlineValue ?? args[++index];

      if (!value || value.startsWith('--')) {
        throw new Error(`Missing value for --${name}.`);
      }

      values.set(name, value);
      continue;
    }

    positional.push(argument);
  }

  return {
    duration: values.get('duration') ?? positional[0],
    url: values.get('url') ?? positional[1]
  };
};

const sendCheckIn = async (url: URL, label: string, signal: AbortSignal) => {
  const startedAt = new Date();
  console.log(`[${startedAt.toISOString()}] Sending ${label} check-in...`);

  const requestController = new AbortController();
  const abortRequest = () => requestController.abort(signal.reason);
  const timeout = setTimeout(
    () => requestController.abort(new Error('Check-in timed out after 15s.')),
    15_000
  );
  signal.addEventListener('abort', abortRequest, { once: true });

  let response: Response;
  try {
    response = await fetch(url, {
      method: 'GET',
      headers: { accept: 'application/json' },
      signal: requestController.signal
    });
  } finally {
    clearTimeout(timeout);
    signal.removeEventListener('abort', abortRequest);
  }

  const body = await response.text();

  if (!response.ok) {
    throw new Error(
      `Check-in failed with ${response.status} ${response.statusText}${body ? `: ${body}` : ''}`
    );
  }

  console.log(
    `[${new Date().toISOString()}] ${label[0].toUpperCase()}${label.slice(1)} check-in accepted (${response.status})${body ? `: ${body}` : ''}`
  );
};

const main = async () => {
  const input = readArguments();
  const durationMs = parseDuration(input.duration, 'Duration');

  if (!input.url) {
    throw new Error('URL is required.');
  }

  const url = new URL(input.url);
  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    throw new Error('URL must use http or https.');
  }

  const controller = new AbortController();
  process.once('SIGINT', () => controller.abort(new Error('Interrupted.')));
  process.once('SIGTERM', () => controller.abort(new Error('Terminated.')));

  console.log(`Sending a heartbeat to ${url.toString()} every ${formatDuration(durationMs)}.`);

  try {
    let checkInNumber = 1;

    while (!controller.signal.aborted) {
      await sendCheckIn(url, `#${checkInNumber}`, controller.signal);
      checkInNumber += 1;
      await sleep(durationMs, controller.signal);
    }
  } catch (error) {
    if (!controller.signal.aborted) {
      throw error;
    }
  }

  console.log('\nHeartbeat sender stopped.');
};

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  console.error(`\n${usage.trim()}`);
  process.exitCode = 1;
});
