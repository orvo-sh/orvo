package agentconfig

import (
	"os"
	"path/filepath"
	"testing"
)

func TestWriteAndReadEnvironment(t *testing.T) {
	t.Parallel()

	directory := t.TempDir()
	err := Write(directory, Values{
		AgentID:      "agnt_test",
		HostID:       "host_test",
		HostName:     "test-mac",
		OS:           "darwin",
		Architecture: "arm64",
		Version:      "0.1.0",
		Environment:  "development",
		Endpoint:     "https://ingest.orvo.sh",
		Key:          "ing_test",
		StateDir:     "/tmp/orvo-agent",
	})
	if err != nil {
		t.Fatalf("Write() error = %v", err)
	}

	values, err := ReadEnvironment(directory)
	if err != nil {
		t.Fatalf("ReadEnvironment() error = %v", err)
	}
	if values["ORVO_AGENT_ID"] != "agnt_test" {
		t.Fatalf("ORVO_AGENT_ID = %q", values["ORVO_AGENT_ID"])
	}
	if values["ORVO_INGESTION_KEY"] != "ing_test" {
		t.Fatalf("ORVO_INGESTION_KEY = %q", values["ORVO_INGESTION_KEY"])
	}
	if values["ORVO_HOST_NAME"] != "test-mac" {
		t.Fatalf("ORVO_HOST_NAME = %q", values["ORVO_HOST_NAME"])
	}

	info, err := os.Stat(filepath.Join(directory, "credentials.env"))
	if err != nil {
		t.Fatalf("Stat() error = %v", err)
	}
	if info.Mode().Perm() != 0o600 {
		t.Fatalf("credentials mode = %o", info.Mode().Perm())
	}
}

func TestUpdateVersion(t *testing.T) {
	configDir := t.TempDir()
	if err := Write(configDir, Values{
		AgentID:      "agent_test",
		HostID:       "host_test",
		HostName:     "test-host",
		OS:           "linux",
		Architecture: "amd64",
		Version:      "0.1.2",
		Environment:  "production",
		Endpoint:     "https://ingest.orvo.sh",
		Key:          "ing_test",
		StateDir:     "/var/lib/orvo-agent",
	}); err != nil {
		t.Fatal(err)
	}

	if err := UpdateVersion(configDir, "0.1.3"); err != nil {
		t.Fatal(err)
	}
	values, err := ReadEnvironment(configDir)
	if err != nil {
		t.Fatal(err)
	}
	if values["ORVO_AGENT_VERSION"] != "0.1.3" {
		t.Fatalf("ORVO_AGENT_VERSION = %q", values["ORVO_AGENT_VERSION"])
	}
	if values["ORVO_INGESTION_KEY"] != "ing_test" {
		t.Fatalf("ORVO_INGESTION_KEY = %q", values["ORVO_INGESTION_KEY"])
	}
}

func TestWriteRejectsNewlines(t *testing.T) {
	t.Parallel()

	err := Write(t.TempDir(), Values{
		AgentID:      "agnt_test\nINJECTED=value",
		HostID:       "host_test",
		HostName:     "test-host",
		OS:           "linux",
		Architecture: "amd64",
		Version:      "dev",
		Environment:  "development",
		Endpoint:     "http://localhost:4318",
		Key:          "ing_test",
		StateDir:     "/tmp/orvo-agent",
	})
	if err == nil {
		t.Fatal("Write() error = nil")
	}
}
