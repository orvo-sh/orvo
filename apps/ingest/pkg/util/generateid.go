package util

import (
	"strings"

	"github.com/oklog/ulid/v2"
)

func GenerateID(prefix ...string) string {
	if len(prefix) == 0 {
		return strings.ToLower(ulid.Make().String())
	}

	return strings.ToLower(prefix[0] + "_" + ulid.Make().String())
}
