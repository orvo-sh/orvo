package ingest

import (
	"strings"
	"time"

	"github.com/oklog/ulid/v2"
)

func GenerateID(prefix ...string) string {
	if len(prefix) == 0 {
		return strings.ToLower(ulid.Make().String())
	}

	return strings.ToLower(prefix[0] + "_" + ulid.Make().String())
}

func NanoToTime(value uint64) time.Time {
	if value == 0 {
		return time.Time{}
	}

	return time.Unix(0, int64(value)).UTC()
}
