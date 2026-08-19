package main

import (
	"context"
	"errors"
	"flag"
	"fmt"
	"net"
	"net/http"
	"net/url"
	"os"
	"os/exec"
	"path/filepath"
	"runtime"
	"strings"
	"time"

	"github.com/orvo-sh/orvo-agent/internal/agentconfig"
	"github.com/orvo-sh/orvo-agent/internal/enrollment"
	"github.com/orvo-sh/orvo-agent/internal/hostidentity"
)

var version = "dev"

func main() {
	if len(os.Args) < 2 {
		usage()
		os.Exit(2)
	}

	var err error
	switch os.Args[1] {
	case "enroll":
		err = enroll(os.Args[2:])
	case "dev":
		err = dev(os.Args[2:])
	case "status":
		err = status(os.Args[2:])
	case "doctor":
		err = doctor(os.Args[2:])
	case "uninstall":
		err = uninstall(os.Args[2:])
	case "version", "--version", "-v":
		fmt.Printf("orvo-agentctl %s\n", version)
	case "help", "--help", "-h":
		usage()
	default:
		err = fmt.Errorf("unknown command %q", os.Args[1])
	}

	if err != nil {
		fmt.Fprintf(os.Stderr, "orvo-agentctl: %v\n", err)
		os.Exit(1)
	}
}

func usage() {
	fmt.Println(`Orvo Agent management CLI

Usage:
  orvo-agentctl enroll [options]
  orvo-agentctl dev [options]
  orvo-agentctl status
  orvo-agentctl doctor
  orvo-agentctl uninstall [--purge]
  orvo-agentctl version`)
}

func enroll(args []string) error {
	flags := flag.NewFlagSet("enroll", flag.ContinueOnError)
	token := flags.String("token", "", "one-time enrollment token")
	controlURL := flags.String("control-url", valueOrDefault("ORVO_CONTROL_URL", "https://app.orvo.sh"), "Orvo control-plane URL")
	configDir := flags.String("config-dir", "/etc/orvo-agent", "configuration directory")
	stateDir := flags.String("state-dir", "/var/lib/orvo-agent", "state directory")
	if err := flags.Parse(args); err != nil {
		return err
	}
	if *token == "" {
		return errors.New("missing --token")
	}

	hostID, hostName, err := hostidentity.Resolve(*stateDir)
	if err != nil {
		return err
	}

	ctx, cancel := context.WithTimeout(context.Background(), 20*time.Second)
	defer cancel()
	result, err := enrollment.Redeem(ctx, *controlURL, enrollment.Input{
		Token:        *token,
		HostID:       hostID,
		HostName:     hostName,
		OperatingSys: runtime.GOOS,
		Architecture: runtime.GOARCH,
		AgentVersion: version,
	})
	if err != nil {
		return err
	}

	if err := agentconfig.Write(*configDir, agentconfig.Values{
		AgentID:      result.AgentID,
		HostID:       hostID,
		HostName:     hostName,
		OS:           runtime.GOOS,
		Architecture: runtime.GOARCH,
		Version:      version,
		Environment:  result.Environment,
		Endpoint:     result.Endpoint,
		Key:          result.Key,
		StateDir:     *stateDir,
	}); err != nil {
		return err
	}

	fmt.Printf("Enrolled %s as %s.\n", hostName, result.AgentID)
	return nil
}

func dev(args []string) error {
	flags := flag.NewFlagSet("dev", flag.ContinueOnError)
	agentBinary := flags.String("agent-binary", "./build/orvo-agent", "path to the agent binary")
	endpoint := flags.String("endpoint", os.Getenv("ORVO_OTLP_ENDPOINT"), "OTLP endpoint")
	key := flags.String("ingestion-key", os.Getenv("ORVO_INGESTION_KEY"), "ingestion key")
	environment := flags.String("environment", valueOrDefault("ORVO_ENVIRONMENT", "development"), "deployment environment")
	if err := flags.Parse(args); err != nil {
		return err
	}
	if *endpoint == "" || *key == "" {
		return errors.New("set ORVO_OTLP_ENDPOINT and ORVO_INGESTION_KEY")
	}

	tempDir, err := os.MkdirTemp("", "orvo-agent-dev-")
	if err != nil {
		return fmt.Errorf("create temporary directory: %w", err)
	}
	defer os.RemoveAll(tempDir)

	hostID, hostName, err := hostidentity.Resolve(tempDir)
	if err != nil {
		return err
	}
	if err := agentconfig.Write(tempDir, agentconfig.Values{
		AgentID:      "dev-" + hostID,
		HostID:       hostID,
		HostName:     hostName,
		OS:           runtime.GOOS,
		Architecture: runtime.GOARCH,
		Version:      version,
		Environment:  *environment,
		Endpoint:     *endpoint,
		Key:          *key,
		StateDir:     tempDir,
	}); err != nil {
		return err
	}

	environmentValues, err := agentconfig.ReadEnvironment(tempDir)
	if err != nil {
		return err
	}
	command := exec.Command(*agentBinary, "--config", filepath.Join(tempDir, "config.yaml"))
	command.Env = append(os.Environ(), mapEnvironment(environmentValues)...)
	command.Stdout = os.Stdout
	command.Stderr = os.Stderr
	command.Stdin = os.Stdin
	fmt.Printf("Running Orvo Agent for %s. Press Ctrl+C to stop.\n", hostName)
	return command.Run()
}

func status(args []string) error {
	flags := flag.NewFlagSet("status", flag.ContinueOnError)
	configDir := flags.String("config-dir", "/etc/orvo-agent", "configuration directory")
	if err := flags.Parse(args); err != nil {
		return err
	}
	values, err := agentconfig.ReadEnvironment(*configDir)
	if err != nil {
		return err
	}

	serviceStatus := "unavailable"
	if runtime.GOOS == "linux" {
		if output, commandErr := exec.Command("systemctl", "is-active", "orvo-agent.service").Output(); commandErr == nil {
			serviceStatus = strings.TrimSpace(string(output))
		} else {
			serviceStatus = "inactive"
		}
	}

	fmt.Printf("Orvo Agent %s\n", values["ORVO_AGENT_VERSION"])
	fmt.Printf("Service     %s\n", serviceStatus)
	fmt.Printf("Agent ID    %s\n", values["ORVO_AGENT_ID"])
	fmt.Printf("Host        %s\n", values["ORVO_HOST_NAME"])
	fmt.Printf("Environment %s\n", values["ORVO_ENVIRONMENT"])
	fmt.Printf("Endpoint    %s\n", values["ORVO_OTLP_ENDPOINT"])
	return nil
}

func doctor(args []string) error {
	flags := flag.NewFlagSet("doctor", flag.ContinueOnError)
	configDir := flags.String("config-dir", "/etc/orvo-agent", "configuration directory")
	agentBinary := flags.String("agent-binary", "/usr/bin/orvo-agent", "path to the agent binary")
	if err := flags.Parse(args); err != nil {
		return err
	}
	values, err := agentconfig.ReadEnvironment(*configDir)
	if err != nil {
		return err
	}

	command := exec.Command(*agentBinary, "validate", "--config", filepath.Join(*configDir, "config.yaml"))
	command.Env = append(os.Environ(), mapEnvironment(values)...)
	if output, err := command.CombinedOutput(); err != nil {
		return fmt.Errorf("configuration is invalid: %s", strings.TrimSpace(string(output)))
	}
	fmt.Println("✓ configuration is valid")

	endpoint, err := url.Parse(values["ORVO_OTLP_ENDPOINT"])
	if err != nil || endpoint.Hostname() == "" {
		return errors.New("OTLP endpoint is invalid")
	}
	port := endpoint.Port()
	if port == "" {
		if endpoint.Scheme == "https" {
			port = "443"
		} else {
			port = "80"
		}
	}
	connection, err := net.DialTimeout("tcp", net.JoinHostPort(endpoint.Hostname(), port), 5*time.Second)
	if err != nil {
		return fmt.Errorf("cannot connect to OTLP endpoint: %w", err)
	}
	connection.Close()
	fmt.Println("✓ OTLP endpoint is reachable")

	response, err := (&http.Client{Timeout: 3 * time.Second}).Get("http://127.0.0.1:13133/")
	if err != nil {
		return fmt.Errorf("local agent health check failed: %w", err)
	}
	response.Body.Close()
	if response.StatusCode != http.StatusOK {
		return fmt.Errorf("local agent health check returned HTTP %d", response.StatusCode)
	}
	fmt.Println("✓ local agent is healthy")
	return nil
}

func uninstall(args []string) error {
	flags := flag.NewFlagSet("uninstall", flag.ContinueOnError)
	purge := flags.Bool("purge", false, "also remove configuration and state")
	if err := flags.Parse(args); err != nil {
		return err
	}
	if runtime.GOOS != "linux" {
		return errors.New("uninstall is currently supported on Linux only")
	}
	if os.Geteuid() != 0 {
		return errors.New("run uninstall with sudo or as root")
	}

	_ = exec.Command("systemctl", "disable", "--now", "orvo-agent.service").Run()
	for _, path := range []string{
		"/etc/systemd/system/orvo-agent.service",
		"/usr/bin/orvo-agent",
		"/usr/bin/orvo-agentctl",
	} {
		if err := os.Remove(path); err != nil && !errors.Is(err, os.ErrNotExist) {
			return fmt.Errorf("remove %s: %w", path, err)
		}
	}
	if *purge {
		for _, path := range []string{"/etc/orvo-agent", "/var/lib/orvo-agent"} {
			if err := os.RemoveAll(path); err != nil {
				return fmt.Errorf("remove %s: %w", path, err)
			}
		}
	}
	_ = exec.Command("systemctl", "daemon-reload").Run()
	fmt.Println("Orvo Agent removed.")
	return nil
}

func valueOrDefault(name, fallback string) string {
	if value := os.Getenv(name); value != "" {
		return value
	}
	return fallback
}

func mapEnvironment(values map[string]string) []string {
	result := make([]string, 0, len(values))
	for name, value := range values {
		result = append(result, name+"="+value)
	}
	return result
}
