package main

import (
	"context"
	"flag"
	"fmt"
	"log"
	"os"
	"os/exec"
	"os/signal"
	"path/filepath"
	"syscall"

	"github.com/orvo-sh/orvo/apps/local/internal/assets"
	localconfig "github.com/orvo-sh/orvo/apps/local/internal/config"
	"github.com/orvo-sh/orvo/apps/local/internal/instance"
	"github.com/orvo-sh/orvo/apps/local/internal/localruntime"
	localpaths "github.com/orvo-sh/orvo/apps/local/internal/paths"
	"github.com/orvo-sh/orvo/apps/local/internal/update"
)

var version = "dev"

func main() {
	log.SetFlags(0)
	if err := run(os.Args[1:]); err != nil {
		log.Fatal(err)
	}
}

func run(args []string) error {
	paths, err := localpaths.Resolve()
	if err != nil {
		return err
	}
	if err := paths.Ensure(); err != nil {
		return err
	}
	config, err := localconfig.Load(paths.Config)
	if err != nil {
		return err
	}

	command := "start"
	if len(args) > 0 {
		command = args[0]
		args = args[1:]
	}

	switch command {
	case "start":
		flags := flag.NewFlagSet("orvo start", flag.ContinueOnError)
		noOpen := flags.Bool("no-open", false, "do not open the dashboard")
		if err := flags.Parse(args); err != nil {
			return err
		}
		lock, err := instance.Acquire(paths.Data)
		if err != nil {
			return err
		}
		defer lock.Close()
		ctx, stop := signal.NotifyContext(context.Background(), syscall.SIGINT, syscall.SIGTERM)
		defer stop()
		if config.UpdatesEnabled && version != "dev" {
			go notifyUpdate(ctx, version, config.UpdateChannel)
		}
		return localruntime.Run(ctx, paths, config, localruntime.Options{NoOpen: *noOpen, Version: version})
	case "status":
		dashboardURL, err := localruntime.DashboardURL(config)
		if err != nil {
			return err
		}
		fmt.Printf("Orvo Local %s is %s\nData: %s\nDashboard: %s\nOTLP HTTP: http://%s:%d\n", version, instance.Status(paths.Data), paths.Data, dashboardURL, config.Host, config.IngestPort)
		return nil
	case "open":
		dashboardURL, err := localruntime.DashboardURL(config)
		if err != nil {
			return err
		}
		return localruntime.Open(dashboardURL)
	case "setup-token":
		dashboardURL, err := localruntime.DashboardURL(config)
		if err != nil {
			return err
		}
		fmt.Printf("%s/setup?token=%s\n", dashboardURL, config.SetupToken)
		return nil
	case "paths":
		fmt.Printf("Data:   %s\nConfig: %s\nCache:  %s\n", paths.Data, paths.Config, paths.Cache)
		return nil
	case "doctor":
		return doctor(paths, config)
	case "update", "upgrade":
		release, available, err := update.Check(context.Background(), version, config.UpdateChannel)
		if err != nil {
			return err
		}
		if !available {
			fmt.Printf("Orvo Local %s is up to date.\n", version)
			return nil
		}
		if command == "upgrade" {
			if instance.Status(paths.Data) != "stopped" {
				return fmt.Errorf("stop Orvo Local before upgrading")
			}
			fmt.Printf("Upgrading Orvo Local to %s...\n", release.Version)
			if err := update.Install(context.Background(), release); err != nil {
				return err
			}
			fmt.Printf("Orvo Local %s is installed.\n", release.Version)
			return nil
		}
		fmt.Printf("Orvo Local %s is available.\nDownload: %s\n", release.Version, release.URL)
		return nil
	case "version", "--version", "-v":
		fmt.Printf("orvo %s\n", version)
		return nil
	case "help", "--help", "-h":
		printHelp()
		return nil
	default:
		printHelp()
		return fmt.Errorf("unknown command %q", command)
	}
}

func doctor(paths localpaths.Paths, config localconfig.Config) error {
	failed := false
	check := func(label string, err error) {
		if err != nil {
			failed = true
			fmt.Printf("fail  %-18s %v\n", label, err)
			return
		}
		fmt.Printf("ok    %s\n", label)
	}
	runtimeRoot, embedded, err := assets.Prepare(paths.Cache, version)
	check("runtime payload", err)
	if err != nil {
		return fmt.Errorf("doctor found problems")
	}
	if embedded {
		check("Node.js runtime", exists(filepath.Join(runtimeRoot, "node")))
	} else {
		_, err := exec.LookPath("node")
		check("Node.js runtime", err)
		workingDir, err := os.Getwd()
		if err != nil {
			return err
		}
		runtimeRoot = findWorkspaceRoot(workingDir)
	}
	check("data directory", writable(paths.Data))
	check("config directory", writable(paths.Config))
	check("embedded chDB", nil)
	for label, path := range map[string]string{
		"app build":           filepath.Join(runtimeRoot, "apps", "app", "build", "index.js"),
		"PGlite bootstrap":    filepath.Join(runtimeRoot, "apps", "local", "runtime", "bootstrap.mjs"),
		"Postgres migrations": filepath.Join(runtimeRoot, "packages", "db", "drizzle"),
	} {
		check(label, exists(path))
	}
	if failed {
		return fmt.Errorf("doctor found problems")
	}
	return nil
}

func exists(path string) error {
	_, err := os.Stat(path)
	return err
}

func findWorkspaceRoot(start string) string {
	for current := start; ; current = filepath.Dir(current) {
		if exists(filepath.Join(current, "pnpm-workspace.yaml")) == nil {
			return current
		}
		parent := filepath.Dir(current)
		if parent == current {
			return start
		}
	}
}

func notifyUpdate(ctx context.Context, currentVersion string, channel string) {
	release, available, err := update.Check(ctx, currentVersion, channel)
	if err == nil && available {
		fmt.Printf("\nOrvo Local %s is available. Run `orvo upgrade` to install it.\n", release.Version)
	}
}

func writable(dir string) error {
	file, err := os.CreateTemp(dir, ".doctor-*")
	if err != nil {
		return err
	}
	name := file.Name()
	if err := file.Close(); err != nil {
		return err
	}
	return os.Remove(name)
}

func printHelp() {
	fmt.Print(`Orvo Local

Usage:
  orvo start [--no-open]  Start Orvo Local in the foreground
  orvo status             Show runtime status and endpoints
  orvo open               Open the dashboard
  orvo doctor             Check the local runtime
  orvo paths              Show data, config, and cache paths
  orvo setup-token        Print the one-time owner setup URL
  orvo update             Check for a newer local release
  orvo upgrade            Download, verify, and install the latest release
  orvo version            Print the installed version
`)
}
