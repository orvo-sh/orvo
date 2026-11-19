type QueryParamValue = string | number;

type QueryBindings = {
  bindDateTime64: (prefix: string, value: Date) => string;
  bindString: (prefix: string, value: string) => string;
  bindUInt32: (prefix: string, value: number) => string;
  bindUInt64: (prefix: string, value: number) => string;
  query_params: Record<string, QueryParamValue>;
};

const quote = (value: string) =>
  `'${value.replaceAll("\\", "\\\\").replaceAll("'", "\\'")}'`;

const toDateTime64 = (value: Date) =>
  `parseDateTime64BestEffort(${quote(value.toISOString())})`;

const buildInClause = (column: string, values: string[]) =>
  `${column} IN (${values.map((value) => quote(value)).join(", ")})`;

const createQueryBindings = (): QueryBindings => {
  const query_params: Record<string, QueryParamValue> = {};
  let index = 0;

  const bind = (prefix: string, type: string, value: QueryParamValue) => {
    const key = `${prefix}_${index++}`;
    query_params[key] = value;
    return `{${key}:${type}}`;
  };

  return {
    bindDateTime64: (prefix, value) =>
      `parseDateTime64BestEffort(${bind(prefix, "String", value.toISOString())})`,
    bindString: (prefix, value) => bind(prefix, "String", value),
    bindUInt32: (prefix, value) => bind(prefix, "UInt32", value),
    bindUInt64: (prefix, value) => bind(prefix, "UInt64", value),
    query_params,
  };
};

const buildBoundInClause = (
  column: string,
  values: string[],
  bindString: QueryBindings["bindString"],
  prefix: string,
  operator: "IN" | "NOT IN" = "IN",
) =>
  `${column} ${operator} (${values
    .map((value) => bindString(prefix, value))
    .join(", ")})`;

// ClickHouse's simple format has no timezone. Our query session is UTC;
// preserve explicit offsets (and sub-millisecond precision) when provided.
const normalizeDateTime = (value: string | Date) => {
  if (value instanceof Date) return value.toISOString();
  const timestamp = value.trim().replace(" ", "T");
  if (!timestamp || /(?:Z|[+-]\d{2}:?\d{2})$/i.test(timestamp))
    return timestamp;
  return `${timestamp}Z`;
};

export {
  buildBoundInClause,
  buildInClause,
  createQueryBindings,
  normalizeDateTime,
  quote,
  toDateTime64,
  type QueryBindings,
};
