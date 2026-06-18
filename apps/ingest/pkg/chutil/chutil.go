package chutil

import (
	"encoding/json"
	"time"
)

func StringMap(value map[string]string) map[string]string {
	if value == nil {
		return map[string]string{}
	}

	return value
}

func NormalizeStringMap(value map[string]string) map[string]string {
	return StringMap(value)
}

func JSONString(value any, empty string) string {
	if value == nil {
		return empty
	}

	bytes, err := json.Marshal(value)
	if err != nil {
		return empty
	}

	return string(bytes)
}

func MarshalJSON(value any, empty string) string {
	return JSONString(value, empty)
}

func Time(value time.Time, fallback time.Time) time.Time {
	if value.IsZero() {
		value = fallback
	}
	if value.IsZero() {
		value = time.Now().UTC()
	}

	return value.UTC().Truncate(time.Millisecond)
}

func NormalizeTime(value time.Time, fallback time.Time) time.Time {
	return Time(value, fallback)
}

func TimePtr(value time.Time) *time.Time {
	if value.IsZero() {
		return nil
	}

	copy := Time(value, value)
	return &copy
}

func Int64(value *int64) any {
	if value == nil {
		return nil
	}

	return *value
}

func Float64(value *float64) any {
	if value == nil {
		return nil
	}

	return *value
}

func Uint64(value *uint64) any {
	if value == nil {
		return nil
	}

	return *value
}
