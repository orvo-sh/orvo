const formatDuration = (ns: number | string): string => {
  const n = Number(ns);
  if (!Number.isFinite(n)) return "—";

  const ms = n / 1_000_000;
  if (ms < 1) return `${Math.round(n / 1_000)}µs`;
  if (ms < 1000) return `${ms.toFixed(ms < 10 ? 2 : 1)}ms`;

  return `${(ms / 1000).toFixed(2)}s`;
};

export { formatDuration };
