package enrollment

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"
)

func TestRedeem(t *testing.T) {
	t.Parallel()

	server := httptest.NewServer(http.HandlerFunc(func(writer http.ResponseWriter, request *http.Request) {
		if request.URL.Path != "/api/agent/enroll" {
			t.Fatalf("path = %q", request.URL.Path)
		}
		if request.Method != http.MethodPost {
			t.Fatalf("method = %q", request.Method)
		}

		var input Input
		if err := json.NewDecoder(request.Body).Decode(&input); err != nil {
			t.Fatalf("Decode() error = %v", err)
		}
		if input.Token != "enr_test" {
			t.Fatalf("token = %q", input.Token)
		}

		_ = json.NewEncoder(writer).Encode(Result{
			AgentID:     "agnt_test",
			Endpoint:    "https://ingest.orvo.sh",
			Key:         "ing_test",
			Environment: "production",
		})
	}))
	defer server.Close()

	result, err := Redeem(context.Background(), server.URL, Input{
		Token:        "enr_test",
		HostID:       "host_test",
		HostName:     "api-01",
		OperatingSys: "linux",
		Architecture: "arm64",
		AgentVersion: "0.1.0",
	})
	if err != nil {
		t.Fatalf("Redeem() error = %v", err)
	}
	if result.AgentID != "agnt_test" {
		t.Fatalf("AgentID = %q", result.AgentID)
	}
}

func TestRedeemReturnsServerError(t *testing.T) {
	t.Parallel()

	server := httptest.NewServer(http.HandlerFunc(func(writer http.ResponseWriter, _ *http.Request) {
		writer.WriteHeader(http.StatusBadRequest)
		_ = json.NewEncoder(writer).Encode(map[string]string{"error": "token expired"})
	}))
	defer server.Close()

	_, err := Redeem(context.Background(), server.URL, Input{AgentVersion: "dev"})
	if err == nil || err.Error() != "enrollment rejected: token expired" {
		t.Fatalf("Redeem() error = %v", err)
	}
}
