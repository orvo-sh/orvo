const formatNumber = (n: number, decimals = 1) => {
  const abs = Math.abs(n);
  const sign = n < 0 ? '-' : '';

  if (abs >= 1_000_000_000_000)
    return `${sign}${(abs / 1_000_000_000_000).toFixed(decimals)}T`;

  if (abs >= 1_000_000_000)
    return `${sign}${(abs / 1_000_000_000).toFixed(decimals)}B`;

  if (abs >= 1_000_000)
    return `${sign}${(abs / 1_000_000).toFixed(decimals)}M`;

  if (abs >= 1_000)
    return `${sign}${(abs / 1_000).toFixed(decimals)}k`;


  return n.toFixed(decimals);
}

export { formatNumber };
