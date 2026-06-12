const quote = (value: string) =>
  `'${value.replaceAll("\\", "\\\\").replaceAll("'", "\\'")}'`;

const toDateTime64 = (value: Date) =>
  `parseDateTime64BestEffort(${quote(value.toISOString())})`;

const buildInClause = (column: string, values: string[]) =>
  `${column} IN (${values.map((value) => quote(value)).join(", ")})`;

export { buildInClause, quote, toDateTime64 };
