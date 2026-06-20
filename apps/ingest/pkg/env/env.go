package env

import (
	"fmt"
	"os"
	"strconv"
	"strings"
	"time"
)

func GetString(key string, fallback string) string {
	value := strings.TrimSpace(os.Getenv(key))
	if value == "" {
		return fallback
	}

	return value
}

func MustString(key string) string {
	value := strings.TrimSpace(os.Getenv(key))
	if value == "" {
		panic(fmt.Sprintf("required environment variable %q is missing", key))
	}

	return value
}

func GetInt(key string, fallback int) int {
	value := strings.TrimSpace(os.Getenv(key))
	if value == "" {
		return fallback
	}

	parsed, err := strconv.Atoi(value)
	if err != nil {
		return fallback
	}

	return parsed
}

func MustInt(key string) int {
	value := MustString(key)

	parsed, err := strconv.Atoi(value)
	if err != nil {
		panic(fmt.Sprintf("required integer environment variable %q is invalid: %v", key, err))
	}

	return parsed
}

func GetInt64(key string, fallback int64) int64 {
	value := strings.TrimSpace(os.Getenv(key))
	if value == "" {
		return fallback
	}

	parsed, err := strconv.ParseInt(value, 10, 64)
	if err != nil {
		return fallback
	}

	return parsed
}

func MustInt64(key string) int64 {
	value := MustString(key)

	parsed, err := strconv.ParseInt(value, 10, 64)
	if err != nil {
		panic(fmt.Sprintf("required int64 environment variable %q is invalid: %v", key, err))
	}

	return parsed
}

func GetDuration(key string, fallback time.Duration) time.Duration {
	value := strings.TrimSpace(os.Getenv(key))
	if value == "" {
		return fallback
	}

	parsed, err := time.ParseDuration(value)
	if err != nil {
		return fallback
	}

	return parsed
}

func MustDuration(key string) time.Duration {
	value := MustString(key)

	parsed, err := time.ParseDuration(value)
	if err != nil {
		panic(fmt.Sprintf("required duration environment variable %q is invalid: %v", key, err))
	}

	return parsed
}

func GetBool(key string, fallback bool) bool {
	value := strings.TrimSpace(os.Getenv(key))
	if value == "" {
		return fallback
	}

	parsed, err := strconv.ParseBool(value)
	if err != nil {
		return fallback
	}

	return parsed
}

func MustBool(key string) bool {
	value := MustString(key)

	parsed, err := strconv.ParseBool(value)
	if err != nil {
		panic(fmt.Sprintf("required boolean environment variable %q is invalid: %v", key, err))
	}

	return parsed
}
