package util

import "time"

func NanoToTime(value uint64) time.Time {
	if value == 0 {
		return time.Time{}
	}

	return time.Unix(0, int64(value)).UTC()
}
