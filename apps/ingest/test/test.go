package test

import (
	"bytes"
	"context"
	"encoding/json"
	"io"
	"net/http"
	"testing"

	chdriver "github.com/ClickHouse/clickhouse-go/v2/lib/driver"

	chclient "github.com/orvo-sh/orvo/apps/ingest/internal/infra/clickhouse"
	pgclient "github.com/orvo-sh/orvo/apps/ingest/internal/infra/postgres"
)

type Test struct {
	Name       string
	Input      HttpRequest
	Validators []Validator
	PreHook    func(context.Context) error
}

type RunConfig struct {
	Tests []Test
	Addr  string

	PostgresDB    *pgclient.Client
	ClickhouseDB  *chclient.Client
	ClickhouseRaw chdriver.Conn
}

type HttpRequest struct {
	Method  string
	URL     string
	Body    []byte
	Headers map[string]string
}

type HttpResponse struct {
	StatusCode int
	Headers    http.Header
	Body       []byte
}

func (response *HttpResponse) JSON(t *testing.T) map[string]any {
	t.Helper()

	if len(response.Body) == 0 {
		return map[string]any{}
	}

	var decoded map[string]any
	if err := json.Unmarshal(response.Body, &decoded); err != nil {
		t.Fatalf("decode http json body: %v", err)
	}

	return decoded
}

func Run(t *testing.T, config RunConfig) {
	t.Helper()

	for _, item := range config.Tests {
		item := item

		t.Run(item.Name, func(t *testing.T) {
			if item.PreHook != nil {
				if err := item.PreHook(context.Background()); err != nil {
					t.Fatalf("run pre hook: %v", err)
				}
			}

			request, err := http.NewRequest(item.Input.Method, "http://"+config.Addr+item.Input.URL, bytes.NewReader(item.Input.Body))
			if err != nil {
				t.Fatalf("create request: %v", err)
			}

			for key, value := range item.Input.Headers {
				request.Header.Set(key, value)
			}

			response, err := http.DefaultClient.Do(request)
			if err != nil {
				t.Fatalf("perform request: %v", err)
			}
			defer response.Body.Close()

			body, err := io.ReadAll(response.Body)
			if err != nil {
				t.Fatalf("read response body: %v", err)
			}

			httpResponse := &HttpResponse{
				StatusCode: response.StatusCode,
				Headers:    response.Header.Clone(),
				Body:       body,
			}

			for _, validator := range item.Validators {
				validator := validator
				t.Run(validator.Name(), func(t *testing.T) {
					validator.Run(t, &Context{
						HttpResponse:  httpResponse,
						PostgresDB:    config.PostgresDB,
						ClickhouseDB:  config.ClickhouseDB,
						ClickhouseRaw: config.ClickhouseRaw,
					})
				})
			}
		})
	}
}
