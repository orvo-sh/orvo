package agentconfig

import (
	"errors"
	"fmt"
	"os"
	"path/filepath"
	"strings"

	agenttemplate "github.com/orvo-sh/orvo/apps/agent/config"
)

type Values struct {
	AgentID      string
	HostID       string
	HostName     string
	OS           string
	Architecture string
	Version      string
	Environment  string
	Endpoint     string
	Key          string
	StateDir     string
}

func Write(configDir string, values Values) error {
	for name, value := range map[string]string{
		"agent id":         values.AgentID,
		"host id":          values.HostID,
		"host name":        values.HostName,
		"operating system": values.OS,
		"architecture":     values.Architecture,
		"version":          values.Version,
		"environment":      values.Environment,
		"endpoint":         values.Endpoint,
		"ingestion key":    values.Key,
		"state directory":  values.StateDir,
	} {
		if strings.ContainsAny(value, "\r\n\x00") {
			return fmt.Errorf("%s contains unsupported characters", name)
		}
	}

	if err := os.MkdirAll(configDir, 0o755); err != nil {
		return fmt.Errorf("create config directory: %w", err)
	}

	if err := os.WriteFile(
		filepath.Join(configDir, "config.yaml"),
		[]byte(agenttemplate.Template),
		0o644,
	); err != nil {
		return fmt.Errorf("write collector config: %w", err)
	}

	credentials := strings.Join([]string{
		"ORVO_AGENT_ID=" + quoteEnv(values.AgentID),
		"ORVO_HOST_ID=" + quoteEnv(values.HostID),
		"ORVO_HOST_NAME=" + quoteEnv(values.HostName),
		"ORVO_OS_TYPE=" + quoteEnv(values.OS),
		"ORVO_HOST_ARCH=" + quoteEnv(values.Architecture),
		"ORVO_AGENT_VERSION=" + quoteEnv(values.Version),
		"ORVO_ENVIRONMENT=" + quoteEnv(values.Environment),
		"ORVO_OTLP_ENDPOINT=" + quoteEnv(values.Endpoint),
		"ORVO_INGESTION_KEY=" + quoteEnv(values.Key),
		"ORVO_AGENT_STATE_DIR=" + quoteEnv(values.StateDir),
		"",
	}, "\n")
	credentialsPath := filepath.Join(configDir, "credentials.env")
	if err := os.WriteFile(credentialsPath, []byte(credentials), 0o600); err != nil {
		return fmt.Errorf("write credentials: %w", err)
	}

	return os.Chmod(credentialsPath, 0o600)
}

func ReadEnvironment(configDir string) (map[string]string, error) {
	content, err := os.ReadFile(filepath.Join(configDir, "credentials.env"))
	if err != nil {
		return nil, fmt.Errorf("read credentials: %w", err)
	}

	values := make(map[string]string)
	for line := range strings.SplitSeq(string(content), "\n") {
		line = strings.TrimSpace(line)
		if line == "" || strings.HasPrefix(line, "#") {
			continue
		}

		name, value, ok := strings.Cut(line, "=")
		if !ok {
			return nil, fmt.Errorf("invalid credentials line for %s", name)
		}

		values[name] = strings.Trim(strings.TrimSpace(value), `"`)
	}

	return values, nil
}

func UpdateVersion(configDir string, version string) error {
	if strings.ContainsAny(version, "\r\n\x00") {
		return errors.New("version contains unsupported characters")
	}

	credentialsPath := filepath.Join(configDir, "credentials.env")
	content, err := os.ReadFile(credentialsPath)
	if err != nil {
		return fmt.Errorf("read credentials: %w", err)
	}

	lines := strings.Split(string(content), "\n")
	updated := false
	for index, line := range lines {
		if strings.HasPrefix(line, "ORVO_AGENT_VERSION=") {
			lines[index] = "ORVO_AGENT_VERSION=" + quoteEnv(version)
			updated = true
			break
		}
	}
	if !updated {
		return errors.New("credentials do not contain ORVO_AGENT_VERSION")
	}

	temporary, err := os.CreateTemp(configDir, ".credentials-*")
	if err != nil {
		return fmt.Errorf("create temporary credentials: %w", err)
	}
	temporaryPath := temporary.Name()
	defer os.Remove(temporaryPath)
	if err := temporary.Chmod(0o600); err != nil {
		temporary.Close()
		return fmt.Errorf("secure temporary credentials: %w", err)
	}
	if _, err := temporary.WriteString(strings.Join(lines, "\n")); err != nil {
		temporary.Close()
		return fmt.Errorf("write temporary credentials: %w", err)
	}
	if err := temporary.Close(); err != nil {
		return fmt.Errorf("close temporary credentials: %w", err)
	}
	if err := os.Rename(temporaryPath, credentialsPath); err != nil {
		return fmt.Errorf("replace credentials: %w", err)
	}
	return nil
}

func quoteEnv(value string) string {
	return `"` + strings.NewReplacer(`\`, `\\`, `"`, `\"`).Replace(value) + `"`
}
