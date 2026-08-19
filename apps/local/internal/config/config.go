package config

import (
	"crypto/rand"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"
	"strconv"
)

type Config struct {
	Host             string `json:"host"`
	PublicURL        string `json:"public_url,omitempty"`
	Port             int    `json:"port"`
	IngestPort       int    `json:"ingest_port"`
	PostgresPort     int    `json:"postgres_port"`
	ClickHousePort   int    `json:"clickhouse_port"`
	UpdateChannel    string `json:"update_channel"`
	UpdatesEnabled   bool   `json:"updates_enabled"`
	EncryptionSecret string `json:"encryption_secret"`
	SetupToken       string `json:"setup_token"`
}

func Load(dir string) (Config, error) {
	path := filepath.Join(dir, "config.json")
	bytes, err := os.ReadFile(path)
	if err == nil {
		var value Config
		if err := json.Unmarshal(bytes, &value); err != nil {
			return Config{}, fmt.Errorf("decode config: %w", err)
		}
		changed := false
		if value.ClickHousePort == 0 {
			value.ClickHousePort = 58123
			changed = true
		}
		if value.SetupToken == "" {
			value.SetupToken, err = randomSecret()
			if err != nil {
				return Config{}, fmt.Errorf("generate setup token: %w", err)
			}
			changed = true
		}
		if changed {
			if err := write(path, value); err != nil {
				return Config{}, err
			}
		}
		return withEnv(value), nil
	}
	if !os.IsNotExist(err) {
		return Config{}, fmt.Errorf("read config: %w", err)
	}

	secret, err := randomSecret()
	if err != nil {
		return Config{}, fmt.Errorf("generate encryption secret: %w", err)
	}
	setupToken, err := randomSecret()
	if err != nil {
		return Config{}, fmt.Errorf("generate setup token: %w", err)
	}
	value := Config{
		Host:             "127.0.0.1",
		Port:             4173,
		IngestPort:       4318,
		PostgresPort:     54432,
		ClickHousePort:   58123,
		UpdateChannel:    "stable",
		UpdatesEnabled:   true,
		EncryptionSecret: secret,
		SetupToken:       setupToken,
	}
	if err := write(path, value); err != nil {
		return Config{}, err
	}
	return withEnv(value), nil
}

func randomSecret() (string, error) {
	secret := make([]byte, 32)
	if _, err := rand.Read(secret); err != nil {
		return "", err
	}
	return hex.EncodeToString(secret), nil
}

func write(path string, value Config) error {
	encoded, err := json.MarshalIndent(value, "", "  ")
	if err != nil {
		return fmt.Errorf("encode config: %w", err)
	}
	if err := os.WriteFile(path, append(encoded, '\n'), 0o600); err != nil {
		return fmt.Errorf("write config: %w", err)
	}
	return nil
}

func withEnv(value Config) Config {
	if host := os.Getenv("ORVO_HOST"); host != "" {
		value.Host = host
	}
	if publicURL := os.Getenv("ORVO_PUBLIC_URL"); publicURL != "" {
		value.PublicURL = publicURL
	}
	if setupToken := os.Getenv("ORVO_SETUP_TOKEN"); setupToken != "" {
		value.SetupToken = setupToken
	}
	for name, target := range map[string]*int{
		"ORVO_PORT":            &value.Port,
		"ORVO_INGEST_PORT":     &value.IngestPort,
		"ORVO_POSTGRES_PORT":   &value.PostgresPort,
		"ORVO_CLICKHOUSE_PORT": &value.ClickHousePort,
	} {
		if raw := os.Getenv(name); raw != "" {
			if port, err := strconv.Atoi(raw); err == nil {
				*target = port
			}
		}
	}
	return value
}
