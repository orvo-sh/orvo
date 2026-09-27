package update

import (
	"archive/tar"
	"compress/gzip"
	"context"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"os"
	"path/filepath"
	"regexp"
	"strconv"
	"strings"
	"time"
)

var versionPattern = regexp.MustCompile(`^[0-9]+\.[0-9]+\.[0-9]+$`)

type Release struct {
	Version      string
	ArchiveURL   string
	ChecksumsURL string
}

type Bundle struct {
	AgentPath   string
	CLIPath     string
	ServicePath string
}

func Resolve(ctx context.Context, requestedVersion string) (Release, error) {
	releaseBaseURL := valueOrDefault("ORVO_AGENT_RELEASE_BASE_URL", "https://github.com/orvo-sh/orvo/releases/download")
	if requestedVersion != "" {
		if !versionPattern.MatchString(requestedVersion) {
			return Release{}, errors.New("version must match X.Y.Z")
		}
		return releaseForVersion(releaseBaseURL, requestedVersion), nil
	}

	request, err := http.NewRequestWithContext(
		ctx,
		http.MethodGet,
		valueOrDefault("ORVO_AGENT_RELEASES_API_URL", "https://api.github.com/repos/orvo-sh/orvo/releases?per_page=30"),
		nil,
	)
	if err != nil {
		return Release{}, fmt.Errorf("create release request: %w", err)
	}
	request.Header.Set("Accept", "application/vnd.github+json")
	request.Header.Set("User-Agent", "orvo-agentctl")

	response, err := (&http.Client{Timeout: 15 * time.Second}).Do(request)
	if err != nil {
		return Release{}, fmt.Errorf("check for agent updates: %w", err)
	}
	defer response.Body.Close()
	if response.StatusCode != http.StatusOK {
		return Release{}, fmt.Errorf("check for agent updates: GitHub returned HTTP %d", response.StatusCode)
	}

	var releases []struct {
		TagName    string `json:"tag_name"`
		Draft      bool   `json:"draft"`
		Prerelease bool   `json:"prerelease"`
	}
	if err := json.NewDecoder(response.Body).Decode(&releases); err != nil {
		return Release{}, fmt.Errorf("decode agent releases: %w", err)
	}

	latestVersion := ""
	for _, release := range releases {
		version := strings.TrimPrefix(release.TagName, "agent-v")
		if release.Draft || release.Prerelease || release.TagName != "agent-v"+version || !versionPattern.MatchString(version) {
			continue
		}
		if latestVersion == "" || IsNewer(version, latestVersion) {
			latestVersion = version
		}
	}
	if latestVersion == "" {
		return Release{}, errors.New("no stable Orvo Agent releases are published")
	}
	return releaseForVersion(releaseBaseURL, latestVersion), nil
}

func IsNewer(candidate string, current string) bool {
	candidateParts := strings.Split(candidate, ".")
	currentParts := strings.Split(current, ".")
	if len(candidateParts) != 3 || len(currentParts) != 3 {
		return candidate != current
	}
	for index := range 3 {
		candidateNumber, candidateErr := strconv.Atoi(candidateParts[index])
		currentNumber, currentErr := strconv.Atoi(currentParts[index])
		if candidateErr != nil || currentErr != nil {
			return candidate != current
		}
		if candidateNumber != currentNumber {
			return candidateNumber > currentNumber
		}
	}
	return false
}

func Download(ctx context.Context, release Release, architecture string, destination string) (Bundle, error) {
	assetName := fmt.Sprintf("orvo-agent_%s_linux_%s.tar.gz", release.Version, architecture)
	checksumsPath := filepath.Join(destination, "checksums.txt")
	archivePath := filepath.Join(destination, assetName)
	if err := download(ctx, release.ChecksumsURL, checksumsPath); err != nil {
		return Bundle{}, err
	}
	if err := download(ctx, strings.Replace(release.ArchiveURL, "%s", architecture, 1), archivePath); err != nil {
		return Bundle{}, err
	}

	checksums, err := os.ReadFile(checksumsPath)
	if err != nil {
		return Bundle{}, fmt.Errorf("read checksums: %w", err)
	}
	expectedChecksum := ""
	for line := range strings.SplitSeq(string(checksums), "\n") {
		fields := strings.Fields(line)
		if len(fields) == 2 && strings.TrimPrefix(fields[1], "*") == assetName {
			expectedChecksum = fields[0]
			break
		}
	}
	if expectedChecksum == "" {
		return Bundle{}, fmt.Errorf("release checksums do not contain %s", assetName)
	}

	archive, err := os.Open(archivePath)
	if err != nil {
		return Bundle{}, fmt.Errorf("open release archive: %w", err)
	}
	hash := sha256.New()
	if _, err := io.Copy(hash, archive); err != nil {
		archive.Close()
		return Bundle{}, fmt.Errorf("hash release archive: %w", err)
	}
	archive.Close()
	if !strings.EqualFold(hex.EncodeToString(hash.Sum(nil)), expectedChecksum) {
		return Bundle{}, errors.New("release archive checksum verification failed")
	}

	extractRoot := filepath.Join(destination, "release")
	if err := os.MkdirAll(extractRoot, 0o755); err != nil {
		return Bundle{}, fmt.Errorf("create extraction directory: %w", err)
	}
	if err := extract(archivePath, extractRoot); err != nil {
		return Bundle{}, err
	}
	versionContent, err := os.ReadFile(filepath.Join(extractRoot, "VERSION"))
	if err != nil || strings.TrimSpace(string(versionContent)) != release.Version {
		return Bundle{}, errors.New("release archive contains an unexpected version")
	}

	bundle := Bundle{
		AgentPath:   filepath.Join(extractRoot, "orvo-agent"),
		CLIPath:     filepath.Join(extractRoot, "orvo-agentctl"),
		ServicePath: filepath.Join(extractRoot, "orvo-agent.service"),
	}
	for _, path := range []string{bundle.AgentPath, bundle.CLIPath, bundle.ServicePath} {
		if info, err := os.Stat(path); err != nil || !info.Mode().IsRegular() {
			return Bundle{}, fmt.Errorf("release archive is missing %s", filepath.Base(path))
		}
	}
	return bundle, nil
}

func releaseForVersion(releaseBaseURL string, version string) Release {
	baseURL := strings.TrimRight(releaseBaseURL, "/") + "/agent-v" + version
	return Release{
		Version:      version,
		ArchiveURL:   fmt.Sprintf("%s/orvo-agent_%s_linux_%%s.tar.gz", baseURL, version),
		ChecksumsURL: baseURL + "/checksums.txt",
	}
}

func download(ctx context.Context, sourceURL string, destination string) error {
	request, err := http.NewRequestWithContext(ctx, http.MethodGet, sourceURL, nil)
	if err != nil {
		return fmt.Errorf("create download request: %w", err)
	}
	response, err := (&http.Client{Timeout: 2 * time.Minute}).Do(request)
	if err != nil {
		return fmt.Errorf("download %s: %w", filepath.Base(destination), err)
	}
	defer response.Body.Close()
	if response.StatusCode != http.StatusOK {
		return fmt.Errorf("download %s: HTTP %d", filepath.Base(destination), response.StatusCode)
	}
	file, err := os.OpenFile(destination, os.O_CREATE|os.O_EXCL|os.O_WRONLY, 0o600)
	if err != nil {
		return fmt.Errorf("create %s: %w", filepath.Base(destination), err)
	}
	_, copyErr := io.Copy(file, response.Body)
	closeErr := file.Close()
	if copyErr != nil {
		return fmt.Errorf("download %s: %w", filepath.Base(destination), copyErr)
	}
	if closeErr != nil {
		return fmt.Errorf("close %s: %w", filepath.Base(destination), closeErr)
	}
	return nil
}

func extract(archivePath string, destination string) error {
	archive, err := os.Open(archivePath)
	if err != nil {
		return fmt.Errorf("open release archive: %w", err)
	}
	defer archive.Close()
	gzipReader, err := gzip.NewReader(archive)
	if err != nil {
		return fmt.Errorf("open compressed release archive: %w", err)
	}
	defer gzipReader.Close()

	allowed := map[string]os.FileMode{
		"orvo-agent":         0o755,
		"orvo-agentctl":      0o755,
		"orvo-agent.service": 0o644,
		"VERSION":            0o644,
	}
	reader := tar.NewReader(gzipReader)
	for {
		header, err := reader.Next()
		if errors.Is(err, io.EOF) {
			break
		}
		if err != nil {
			return fmt.Errorf("read release archive: %w", err)
		}
		name := strings.TrimPrefix(filepath.Clean(header.Name), "./")
		mode, ok := allowed[name]
		if !ok {
			continue
		}
		if header.Typeflag != tar.TypeReg && header.Typeflag != tar.TypeRegA {
			return fmt.Errorf("release archive contains invalid %s", name)
		}
		output, err := os.OpenFile(filepath.Join(destination, name), os.O_CREATE|os.O_EXCL|os.O_WRONLY, mode)
		if err != nil {
			return fmt.Errorf("extract %s: %w", name, err)
		}
		_, copyErr := io.Copy(output, io.LimitReader(reader, header.Size))
		closeErr := output.Close()
		if copyErr != nil || closeErr != nil {
			return fmt.Errorf("extract %s: %w", name, errors.Join(copyErr, closeErr))
		}
	}
	return nil
}

func valueOrDefault(name string, fallback string) string {
	if value := os.Getenv(name); value != "" {
		return value
	}
	return fallback
}
