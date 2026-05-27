package writer

import (
	"encoding/json"
	"strings"
	"time"

	"github.com/oklog/ulid/v2"
)

func GenerateID(prefix string) string {
	return strings.ToLower(prefix + "_" + ulid.Make().String())
}

func NormalizeTime(value time.Time, fallback time.Time) time.Time {
	if value.IsZero() {
		value = fallback
	}
	if value.IsZero() {
		value = time.Now().UTC()
	}
	return value.UTC().Truncate(time.Millisecond)
}

func NormalizeStringMap(value map[string]string) map[string]string {
	if value == nil {
		return map[string]string{}
	}
	return value
}

func MarshalJSON(value any, empty string) string {
	if value == nil {
		return empty
	}

	bytes, err := json.Marshal(value)
	if err != nil {
		return empty
	}

	return string(bytes)
}
