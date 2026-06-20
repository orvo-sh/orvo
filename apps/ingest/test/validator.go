package test

import (
	"context"
	"fmt"
	"reflect"
	"testing"
	"time"

	chdriver "github.com/ClickHouse/clickhouse-go/v2/lib/driver"
	"github.com/jackc/pgx/v5"

	chclient "github.com/orvo-sh/orvo/apps/ingest/internal/infra/clickhouse"
	pgclient "github.com/orvo-sh/orvo/apps/ingest/internal/infra/postgres"
)

type Validator interface {
	Name() string
	Run(t *testing.T, ctx *Context)
}

type Context struct {
	HttpResponse  *HttpResponse
	PostgresDB    *pgclient.Client
	ClickhouseDB  *chclient.Client
	ClickhouseRaw chdriver.Conn
}

type Row map[string]any

type NewPostgresDBValidatorInput struct {
	Name     string
	Query    string
	Args     []any
	Expected []Row
}

func PostgresDBValidator(input NewPostgresDBValidatorInput) Validator {
	return &postgresDBValidator{input: input, eventually: false}
}

func EventuallyPostgresDBValidator(input NewPostgresDBValidatorInput) Validator {
	return &postgresDBValidator{input: input, eventually: true}
}

type postgresDBValidator struct {
	input      NewPostgresDBValidatorInput
	eventually bool
}

func (validator *postgresDBValidator) Name() string {
	if validator.eventually {
		return validator.input.Name + " eventually"
	}

	return validator.input.Name
}

func (validator *postgresDBValidator) Run(t *testing.T, ctx *Context) {
	t.Helper()

	run := func() error {
		rows, err := ctx.PostgresDB.Pool().Query(context.Background(), validator.input.Query, validator.input.Args...)
		if err != nil {
			return fmt.Errorf("execute postgres query: %w", err)
		}
		defer rows.Close()

		result, err := collectPostgresRows(rows)
		if err != nil {
			return err
		}

		return compareRows(result, validator.input.Expected)
	}

	if validator.eventually {
		mustEventually(t, run)
		return
	}

	if err := run(); err != nil {
		t.Fatal(err)
	}
}

type NewClickhouseDBValidatorInput struct {
	Name     string
	Query    string
	Args     []any
	Expected []Row
}

func ClickhouseDBValidator(input NewClickhouseDBValidatorInput) Validator {
	return &clickhouseDBValidator{input: input, eventually: false}
}

func EventuallyClickhouseDBValidator(input NewClickhouseDBValidatorInput) Validator {
	return &clickhouseDBValidator{input: input, eventually: true}
}

type clickhouseDBValidator struct {
	input      NewClickhouseDBValidatorInput
	eventually bool
}

func (validator *clickhouseDBValidator) Name() string {
	if validator.eventually {
		return validator.input.Name + " eventually"
	}

	return validator.input.Name
}

func (validator *clickhouseDBValidator) Run(t *testing.T, ctx *Context) {
	t.Helper()

	run := func() error {
		rows, err := ctx.ClickhouseRaw.Query(context.Background(), validator.input.Query, validator.input.Args...)
		if err != nil {
			return fmt.Errorf("execute clickhouse query: %w", err)
		}
		defer rows.Close()

		result, err := collectClickhouseRows(rows)
		if err != nil {
			return err
		}

		return compareRows(result, validator.input.Expected)
	}

	if validator.eventually {
		mustEventually(t, run)
		return
	}

	if err := run(); err != nil {
		t.Fatal(err)
	}
}

func HttpStatusCodeValidator(expectedCode int) Validator {
	return &httpStatusCodeValidator{expectedCode: expectedCode}
}

type httpStatusCodeValidator struct {
	expectedCode int
}

func (validator *httpStatusCodeValidator) Name() string {
	return fmt.Sprintf("http status code is %d", validator.expectedCode)
}

func (validator *httpStatusCodeValidator) Run(t *testing.T, ctx *Context) {
	t.Helper()

	if validator.expectedCode != ctx.HttpResponse.StatusCode {
		t.Fatalf("expected status code %d, got %d", validator.expectedCode, ctx.HttpResponse.StatusCode)
	}
}

func HttpHeaderExistsValidator(header string) Validator {
	return &httpHeaderExistsValidator{header: header}
}

type httpHeaderExistsValidator struct {
	header string
}

func (validator *httpHeaderExistsValidator) Name() string {
	return fmt.Sprintf("http header %s exists", validator.header)
}

func (validator *httpHeaderExistsValidator) Run(t *testing.T, ctx *Context) {
	t.Helper()

	if ctx.HttpResponse.Headers.Get(validator.header) == "" {
		t.Fatalf("expected header %s to exist", validator.header)
	}
}

func HttpJsonBodyValidator(name string, fn func(t *testing.T, body map[string]any)) Validator {
	return &httpJSONBodyValidator{name: name, fn: fn}
}

type httpJSONBodyValidator struct {
	name string
	fn   func(t *testing.T, body map[string]any)
}

func (validator *httpJSONBodyValidator) Name() string {
	return validator.name
}

func (validator *httpJSONBodyValidator) Run(t *testing.T, ctx *Context) {
	t.Helper()
	validator.fn(t, ctx.HttpResponse.JSON(t))
}

func CustomValidator(name string, fn func(t *testing.T, ctx *Context)) Validator {
	return &customValidator{name: name, fn: fn}
}

type customValidator struct {
	name string
	fn   func(t *testing.T, ctx *Context)
}

func (validator *customValidator) Name() string {
	return validator.name
}

func (validator *customValidator) Run(t *testing.T, ctx *Context) {
	t.Helper()
	validator.fn(t, ctx)
}

func collectPostgresRows(rows pgx.Rows) ([]Row, error) {
	fieldDescriptions := rows.FieldDescriptions()
	result := make([]Row, 0)

	for rows.Next() {
		values, err := rows.Values()
		if err != nil {
			return nil, fmt.Errorf("read postgres row values: %w", err)
		}

		row := make(Row, len(fieldDescriptions))
		for index, field := range fieldDescriptions {
			row[string(field.Name)] = values[index]
		}
		result = append(result, row)
	}

	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("iterate postgres rows: %w", err)
	}

	return result, nil
}

func collectClickhouseRows(rows chdriver.Rows) ([]Row, error) {
	columns := rows.Columns()
	columnTypes := rows.ColumnTypes()
	result := make([]Row, 0)

	for rows.Next() {
		scanTargets := make([]any, len(columns))
		for index, columnType := range columnTypes {
			scanTargets[index] = reflect.New(columnType.ScanType()).Interface()
		}

		if err := rows.Scan(scanTargets...); err != nil {
			return nil, fmt.Errorf("scan clickhouse row: %w", err)
		}

		row := make(Row, len(columns))
		for index, column := range columns {
			row[column] = reflect.Indirect(reflect.ValueOf(scanTargets[index])).Interface()
		}
		result = append(result, row)
	}

	return result, nil
}

func compareRows(actual []Row, expected []Row) error {
	if len(actual) != len(expected) {
		return fmt.Errorf("row count mismatch: expected %d, got %d", len(expected), len(actual))
	}

	for rowIndex, expectedRow := range expected {
		for key, expectedValue := range expectedRow {
			actualValue, ok := actual[rowIndex][key]
			if !ok {
				return fmt.Errorf("row[%d].%s missing", rowIndex, key)
			}

			if !reflect.DeepEqual(expectedValue, actualValue) {
				return fmt.Errorf("row[%d].%s mismatch: expected %#v (%T), got %#v (%T)", rowIndex, key, expectedValue, expectedValue, actualValue, actualValue)
			}
		}
	}

	return nil
}

func mustEventually(t *testing.T, fn func() error) {
	t.Helper()

	deadline := time.Now().Add(5 * time.Second)
	var lastErr error
	for time.Now().Before(deadline) {
		lastErr = fn()
		if lastErr == nil {
			return
		}
		time.Sleep(25 * time.Millisecond)
	}

	t.Fatalf("eventually assertion failed: %v", lastErr)
}
