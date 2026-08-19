package update

import (
	"context"
	"crypto/sha256"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"os"
	"path/filepath"
	"runtime"
	"strconv"
	"strings"
	"time"
)

type Release struct {
	Version      string
	URL          string
	AssetURL     string
	ChecksumsURL string
}

func Check(ctx context.Context, currentVersion string, channel string) (Release, bool, error) {
	request, err := http.NewRequestWithContext(ctx, http.MethodGet, "https://api.github.com/repos/orvo-sh/orvo/releases?per_page=30", nil)
	if err != nil {
		return Release{}, false, fmt.Errorf("create update request: %w", err)
	}
	request.Header.Set("Accept", "application/vnd.github+json")
	request.Header.Set("User-Agent", "orvo-local/"+currentVersion)

	client := http.Client{Timeout: 10 * time.Second}
	response, err := client.Do(request)
	if err != nil {
		return Release{}, false, fmt.Errorf("check for updates: %w", err)
	}
	defer response.Body.Close()
	if response.StatusCode != http.StatusOK {
		return Release{}, false, fmt.Errorf("check for updates: GitHub returned %s", response.Status)
	}

	var releases []struct {
		TagName    string `json:"tag_name"`
		HTMLURL    string `json:"html_url"`
		Draft      bool   `json:"draft"`
		Prerelease bool   `json:"prerelease"`
		Assets     []struct {
			Name string `json:"name"`
			URL  string `json:"browser_download_url"`
		} `json:"assets"`
	}
	if err := json.NewDecoder(response.Body).Decode(&releases); err != nil {
		return Release{}, false, fmt.Errorf("decode update response: %w", err)
	}

	for _, release := range releases {
		if release.Draft || !strings.HasPrefix(release.TagName, "local-v") {
			continue
		}
		if channel == "stable" && release.Prerelease {
			continue
		}
		version := strings.TrimPrefix(release.TagName, "local-v")
		assetName := fmt.Sprintf("orvo_%s_%s_%s", version, runtime.GOOS, runtime.GOARCH)
		result := Release{Version: version, URL: release.HTMLURL}
		for _, asset := range release.Assets {
			switch asset.Name {
			case assetName:
				result.AssetURL = asset.URL
			case "checksums.txt":
				result.ChecksumsURL = asset.URL
			}
		}
		return result, isNewer(version, currentVersion), nil
	}
	return Release{}, false, fmt.Errorf("no Orvo Local releases are published yet")
}

func isNewer(candidate string, current string) bool {
	if current == "dev" {
		return true
	}
	parse := func(value string) ([]int, string, bool) {
		parts := strings.SplitN(strings.TrimPrefix(value, "v"), "-", 2)
		numbers := strings.Split(parts[0], ".")
		if len(numbers) != 3 {
			return nil, "", false
		}
		parsed := make([]int, 3)
		for index, number := range numbers {
			value, err := strconv.Atoi(number)
			if err != nil {
				return nil, "", false
			}
			parsed[index] = value
		}
		prerelease := ""
		if len(parts) == 2 {
			prerelease = parts[1]
		}
		return parsed, prerelease, true
	}

	candidateNumbers, candidatePrerelease, candidateOK := parse(candidate)
	currentNumbers, currentPrerelease, currentOK := parse(current)
	if !candidateOK || !currentOK {
		return candidate != current
	}
	for index := range candidateNumbers {
		if candidateNumbers[index] != currentNumbers[index] {
			return candidateNumbers[index] > currentNumbers[index]
		}
	}
	if candidatePrerelease == currentPrerelease {
		return false
	}
	if candidatePrerelease == "" {
		return true
	}
	if currentPrerelease == "" {
		return false
	}
	return candidatePrerelease > currentPrerelease
}

func Install(ctx context.Context, release Release) error {
	if release.AssetURL == "" || release.ChecksumsURL == "" {
		return fmt.Errorf("release %s has no asset for %s/%s", release.Version, runtime.GOOS, runtime.GOARCH)
	}

	executable, err := os.Executable()
	if err != nil {
		return fmt.Errorf("resolve current executable: %w", err)
	}
	executable, err = filepath.EvalSymlinks(executable)
	if err != nil {
		return fmt.Errorf("resolve executable symlink: %w", err)
	}

	client := http.Client{Timeout: 2 * time.Minute}
	checksums, err := download(ctx, client, release.ChecksumsURL)
	if err != nil {
		return fmt.Errorf("download checksums: %w", err)
	}
	asset, err := download(ctx, client, release.AssetURL)
	if err != nil {
		return fmt.Errorf("download update: %w", err)
	}

	assetName := filepath.Base(release.AssetURL)
	want := ""
	for _, line := range strings.Split(string(checksums), "\n") {
		fields := strings.Fields(line)
		if len(fields) == 2 && fields[1] == assetName {
			want = fields[0]
			break
		}
	}
	got := fmt.Sprintf("%x", sha256.Sum256(asset))
	if want == "" || !strings.EqualFold(want, got) {
		return fmt.Errorf("update checksum verification failed")
	}

	temporary, err := os.CreateTemp(filepath.Dir(executable), ".orvo-update-*")
	if err != nil {
		return fmt.Errorf("create update beside executable: %w", err)
	}
	temporaryPath := temporary.Name()
	defer os.Remove(temporaryPath)
	if _, err := temporary.Write(asset); err != nil {
		_ = temporary.Close()
		return fmt.Errorf("write update: %w", err)
	}
	if err := temporary.Chmod(0o755); err != nil {
		_ = temporary.Close()
		return fmt.Errorf("make update executable: %w", err)
	}
	if err := temporary.Close(); err != nil {
		return fmt.Errorf("close update: %w", err)
	}

	backup := executable + ".previous"
	_ = os.Remove(backup)
	if err := os.Rename(executable, backup); err != nil {
		return fmt.Errorf("back up current executable: %w", err)
	}
	if err := os.Rename(temporaryPath, executable); err != nil {
		_ = os.Rename(backup, executable)
		return fmt.Errorf("install update: %w", err)
	}
	_ = os.Remove(backup)
	return nil
}

func download(ctx context.Context, client http.Client, url string) ([]byte, error) {
	request, err := http.NewRequestWithContext(ctx, http.MethodGet, url, nil)
	if err != nil {
		return nil, err
	}
	request.Header.Set("User-Agent", "orvo-local-updater")
	response, err := client.Do(request)
	if err != nil {
		return nil, err
	}
	defer response.Body.Close()
	if response.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("server returned %s", response.Status)
	}
	return io.ReadAll(response.Body)
}
