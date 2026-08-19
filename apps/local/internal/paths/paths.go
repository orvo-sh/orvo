package paths

import (
	"fmt"
	"os"
	"path/filepath"
	"runtime"
)

type Paths struct {
	Data   string
	Config string
	Cache  string
}

func Resolve() (Paths, error) {
	if data, config, cache := os.Getenv("ORVO_DATA_DIR"), os.Getenv("ORVO_CONFIG_DIR"), os.Getenv("ORVO_CACHE_DIR"); data != "" && config != "" && cache != "" {
		return Paths{Data: data, Config: config, Cache: cache}, nil
	}

	data, err := dataDir()
	if err != nil {
		return Paths{}, err
	}
	config, err := os.UserConfigDir()
	if err != nil {
		return Paths{}, fmt.Errorf("resolve config directory: %w", err)
	}
	cache, err := os.UserCacheDir()
	if err != nil {
		return Paths{}, fmt.Errorf("resolve cache directory: %w", err)
	}

	return Paths{
		Data:   data,
		Config: filepath.Join(config, "orvo"),
		Cache:  filepath.Join(cache, "orvo"),
	}, nil
}

func (paths Paths) Ensure() error {
	for _, dir := range []string{paths.Data, paths.Config, paths.Cache} {
		if err := os.MkdirAll(dir, 0o700); err != nil {
			return fmt.Errorf("create %s: %w", dir, err)
		}
	}
	return nil
}

func dataDir() (string, error) {
	if runtime.GOOS == "linux" {
		if base := os.Getenv("XDG_DATA_HOME"); base != "" {
			return filepath.Join(base, "orvo"), nil
		}
		home, err := os.UserHomeDir()
		if err != nil {
			return "", fmt.Errorf("resolve home directory: %w", err)
		}
		return filepath.Join(home, ".local", "share", "orvo"), nil
	}

	base, err := os.UserConfigDir()
	if err != nil {
		return "", fmt.Errorf("resolve data directory: %w", err)
	}
	return filepath.Join(base, "orvo"), nil
}
