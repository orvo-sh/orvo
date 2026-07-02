const formatDuration = (totalSeconds: number) => {
  if (!Number.isFinite(totalSeconds) || totalSeconds < 60) {
    return `${Math.max(0, Math.floor(totalSeconds))}s`;
  }

  const units = [
    { label: "w", seconds: 60 * 60 * 24 * 7 },
    { label: "d", seconds: 60 * 60 * 24 },
    { label: "h", seconds: 60 * 60 },
    { label: "m", seconds: 60 },
    { label: "s", seconds: 1 },
  ];
  const parts: string[] = [];
  let remainingSeconds = Math.max(0, Math.floor(totalSeconds));

  for (const unit of units) {
    const value = Math.floor(remainingSeconds / unit.seconds);
    if (value === 0) {
      continue;
    }

    parts.push(`${value}${unit.label}`);
    remainingSeconds -= value * unit.seconds;
  }

  if (parts.length <= 1) {
    return parts[0] ?? "0s";
  }

  if (parts.length === 2) {
    return `${parts[0]} & ${parts[1]}`;
  }

  return `${parts.slice(0, -1).join(", ")} & ${parts.at(-1)}`;
};

const formatDurationNs = (durationNs: number) => {
  if (!Number.isFinite(durationNs)) return "—";
  const ms = durationNs / 1_000_000;
  if (ms < 1) return `${Math.round(durationNs / 1_000)}µs`;
  if (ms < 1000) return `${ms.toFixed(ms < 10 ? 2 : 1)}ms`;
  return `${(ms / 1000).toFixed(2)}s`;
};

export { formatDuration, formatDurationNs };

