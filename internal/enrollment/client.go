package enrollment

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"strings"
	"time"
)

type Input struct {
	Token        string `json:"token"`
	HostID       string `json:"hostId"`
	HostName     string `json:"hostName"`
	OperatingSys string `json:"operatingSystem"`
	Architecture string `json:"architecture"`
	AgentVersion string `json:"agentVersion"`
}

type Result struct {
	AgentID     string `json:"agentId"`
	Endpoint    string `json:"otlpEndpoint"`
	Key         string `json:"ingestionKey"`
	Environment string `json:"environment"`
}

func Redeem(ctx context.Context, controlURL string, input Input) (Result, error) {
	payload, err := json.Marshal(input)
	if err != nil {
		return Result{}, fmt.Errorf("encode enrollment request: %w", err)
	}

	request, err := http.NewRequestWithContext(
		ctx,
		http.MethodPost,
		strings.TrimRight(controlURL, "/")+"/api/agent/enroll",
		bytes.NewReader(payload),
	)
	if err != nil {
		return Result{}, fmt.Errorf("create enrollment request: %w", err)
	}
	request.Header.Set("Content-Type", "application/json")
	request.Header.Set("User-Agent", "orvo-agentctl/"+input.AgentVersion)

	response, err := (&http.Client{Timeout: 15 * time.Second}).Do(request)
	if err != nil {
		return Result{}, fmt.Errorf("contact Orvo: %w", err)
	}
	defer response.Body.Close()

	if response.StatusCode != http.StatusOK {
		var failure struct {
			Error string `json:"error"`
		}
		if err := json.NewDecoder(response.Body).Decode(&failure); err == nil && failure.Error != "" {
			return Result{}, fmt.Errorf("enrollment rejected: %s", failure.Error)
		}
		return Result{}, fmt.Errorf("enrollment rejected with HTTP %d", response.StatusCode)
	}

	var result Result
	if err := json.NewDecoder(response.Body).Decode(&result); err != nil {
		return Result{}, fmt.Errorf("decode enrollment response: %w", err)
	}
	if result.AgentID == "" || result.Endpoint == "" || result.Key == "" {
		return Result{}, fmt.Errorf("enrollment response is incomplete")
	}

	return result, nil
}
