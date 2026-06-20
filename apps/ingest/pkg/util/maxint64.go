package util

func MaxInt64(value int64, minValue int64) int64 {
	if value < minValue {
		return minValue
	}

	return value
}
