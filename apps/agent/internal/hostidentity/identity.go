package hostidentity

import (
	"crypto/rand"
	"encoding/hex"
	"fmt"
	"os"
	"path/filepath"
	"strings"
)

func Resolve(stateDir string) (string, string, error) {
	hostName, err := os.Hostname()
	if err != nil {
		return "", "", fmt.Errorf("resolve hostname: %w", err)
	}

	if override := strings.TrimSpace(os.Getenv("ORVO_AGENT_HOST_ID")); override != "" {
		return override, hostName, nil
	}

	for _, candidate := range []string{"/etc/machine-id", "/var/lib/dbus/machine-id"} {
		value, err := os.ReadFile(candidate)
		if err == nil && strings.TrimSpace(string(value)) != "" {
			return strings.TrimSpace(string(value)), hostName, nil
		}
	}

	if err := os.MkdirAll(stateDir, 0o750); err != nil {
		return "", "", fmt.Errorf("create state directory: %w", err)
	}

	identityPath := filepath.Join(stateDir, "host-id")
	if value, err := os.ReadFile(identityPath); err == nil && strings.TrimSpace(string(value)) != "" {
		return strings.TrimSpace(string(value)), hostName, nil
	}

	random := make([]byte, 16)
	if _, err := rand.Read(random); err != nil {
		return "", "", fmt.Errorf("generate host id: %w", err)
	}
	hostID := "orvo-" + hex.EncodeToString(random)
	if err := os.WriteFile(identityPath, []byte(hostID+"\n"), 0o600); err != nil {
		return "", "", fmt.Errorf("persist host id: %w", err)
	}

	return hostID, hostName, nil
}
