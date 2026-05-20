CREATE TABLE IF NOT EXISTS events (
  id UUID,
  type LowCardinality(String),
  payload String,
  created_at DateTime DEFAULT now()
)
ENGINE = MergeTree
ORDER BY (type, created_at, id);
