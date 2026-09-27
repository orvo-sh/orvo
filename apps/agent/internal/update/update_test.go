package update

import (
	"context"
	"net/http"
	"net/http/httptest"
	"testing"
)

func TestResolveLatestStableAgentRelease(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(writer http.ResponseWriter, request *http.Request) {
		writer.Header().Set("Content-Type", "application/json")
		_, _ = writer.Write([]byte(`[
          {"tag_name":"local-v9.0.0","draft":false,"prerelease":false},
          {"tag_name":"agent-v0.1.2","draft":false,"prerelease":false},
          {"tag_name":"agent-v0.2.0","draft":false,"prerelease":true},
          {"tag_name":"agent-v0.1.3","draft":false,"prerelease":false}
        ]`))
	}))
	defer server.Close()

	t.Setenv("ORVO_AGENT_RELEASES_API_URL", server.URL)
	t.Setenv("ORVO_AGENT_RELEASE_BASE_URL", "https://releases.example.test")
	release, err := Resolve(context.Background(), "")
	if err != nil {
		t.Fatal(err)
	}
	if release.Version != "0.1.3" {
		t.Fatalf("Version = %q", release.Version)
	}
	if release.ChecksumsURL != "https://releases.example.test/agent-v0.1.3/checksums.txt" {
		t.Fatalf("ChecksumsURL = %q", release.ChecksumsURL)
	}
}

func TestResolvePinnedVersion(t *testing.T) {
	t.Setenv("ORVO_AGENT_RELEASE_BASE_URL", "https://releases.example.test")
	release, err := Resolve(context.Background(), "1.2.3")
	if err != nil {
		t.Fatal(err)
	}
	if release.Version != "1.2.3" {
		t.Fatalf("Version = %q", release.Version)
	}
	if release.ArchiveURL != "https://releases.example.test/agent-v1.2.3/orvo-agent_1.2.3_linux_%s.tar.gz" {
		t.Fatalf("ArchiveURL = %q", release.ArchiveURL)
	}
}

func TestIsNewer(t *testing.T) {
	for _, test := range []struct {
		candidate string
		current   string
		want      bool
	}{
		{candidate: "0.1.3", current: "0.1.2", want: true},
		{candidate: "0.2.0", current: "0.1.9", want: true},
		{candidate: "1.0.0", current: "0.9.9", want: true},
		{candidate: "0.1.2", current: "0.1.2", want: false},
		{candidate: "0.1.1", current: "0.1.2", want: false},
	} {
		if got := IsNewer(test.candidate, test.current); got != test.want {
			t.Errorf("IsNewer(%q, %q) = %t", test.candidate, test.current, got)
		}
	}
}
