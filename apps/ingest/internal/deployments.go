package ingest

import (
	"context"
	"encoding/json"
	"fmt"
	"log/slog"
	"net/http"
	"strings"
	"time"
)

var deploymentStatuses = map[string]struct{}{
	"pending":     {},
	"in_progress": {},
	"succeeded":   {},
	"failed":      {},
	"rolled_back": {},
}

type DeploymentService struct {
	store  *PostgresClient
	logger *slog.Logger
}

type createDeploymentRequest struct {
	ServiceName     string         `json:"serviceName"`
	EnvironmentName string         `json:"environmentName"`
	Version         string         `json:"version"`
	Status          string         `json:"status"`
	StartedAt       string         `json:"startedAt"`
	FinishedAt      string         `json:"finishedAt"`
	GitSHA          string         `json:"gitSha"`
	GitBranch       string         `json:"gitBranch"`
	GitRepository   string         `json:"gitRepository"`
	GitActor        string         `json:"gitActor"`
	CommitMessage   string         `json:"commitMessage"`
	ExternalURL     string         `json:"externalUrl"`
	Metadata        map[string]any `json:"metadata"`
}

type updateDeploymentRequest struct {
	Status      string         `json:"status"`
	FinishedAt  string         `json:"finishedAt"`
	ExternalURL string         `json:"externalUrl"`
	Metadata    map[string]any `json:"metadata"`
}

type validatedCreateDeployment struct {
	ServiceName     string
	EnvironmentName string
	Version         *string
	Status          string
	StartedAt       time.Time
	FinishedAt      *time.Time
	GitSHA          *string
	GitBranch       *string
	GitRepository   *string
	GitActor        *string
	CommitMessage   *string
	ExternalURL     *string
	Metadata        []byte
}

type validatedUpdateDeployment struct {
	Status      *string
	FinishedAt  *time.Time
	ExternalURL *string
	Metadata    []byte
}

func NewDeploymentService(store *PostgresClient, logger *slog.Logger) *DeploymentService {
	return &DeploymentService{
		store:  store,
		logger: logger.With("component", "deployments"),
	}
}

func (service *DeploymentService) handleCreate(writer http.ResponseWriter, request *http.Request, resolved *ResolvedIngestionKey) {
	if request.Method != http.MethodPost {
		http.Error(writer, http.StatusText(http.StatusMethodNotAllowed), http.StatusMethodNotAllowed)
		return
	}

	if resolved.Kind != "private" {
		writeAppError(writer, ErrPrivateIngestionKeyRequired)
		return
	}

	var payload createDeploymentRequest
	if err := json.NewDecoder(request.Body).Decode(&payload); err != nil {
		writeAppError(writer, ErrMalformedPayload)
		return
	}

	validated, appErr := validateCreateDeployment(payload)
	if appErr != nil {
		writeAppError(writer, appErr)
		return
	}

	id, appErr := service.createDeployment(request.Context(), resolved.AppID, *validated)
	if appErr != nil {
		writeAppError(writer, appErr)
		return
	}

	writeJSON(writer, http.StatusCreated, map[string]string{"id": id})
}

func (service *DeploymentService) handleUpdate(writer http.ResponseWriter, request *http.Request, resolved *ResolvedIngestionKey, deploymentID string) {
	if request.Method != http.MethodPatch {
		http.Error(writer, http.StatusText(http.StatusMethodNotAllowed), http.StatusMethodNotAllowed)
		return
	}

	if resolved.Kind != "private" {
		writeAppError(writer, ErrPrivateIngestionKeyRequired)
		return
	}

	var payload updateDeploymentRequest
	if err := json.NewDecoder(request.Body).Decode(&payload); err != nil {
		writeAppError(writer, ErrMalformedPayload)
		return
	}

	validated, appErr := validateUpdateDeployment(payload)
	if appErr != nil {
		writeAppError(writer, appErr)
		return
	}

	appErr = service.updateDeployment(request.Context(), resolved.AppID, deploymentID, *validated)
	if appErr != nil {
		writeAppError(writer, appErr)
		return
	}

	writeJSON(writer, http.StatusOK, map[string]bool{"ok": true})
}

func (service *DeploymentService) createDeployment(ctx context.Context, appID string, payload validatedCreateDeployment) (string, AppError) {
	service.logger.InfoContext(ctx, "CreateDeployment: creating deployment", slog.String("app_id", appID))

	const insertDeployment = `
INSERT INTO deployment (
	id,
	app_id,
	service_name,
	environment_name,
	version,
	status,
	started_at,
	finished_at,
	git_sha,
	git_branch,
	git_repository,
	git_actor,
	commit_message,
	external_url,
	metadata
)
VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
`

	id := GenerateID("dep")
	if _, err := service.store.Pool().Exec(
		ctx,
		insertDeployment,
		id,
		appID,
		payload.ServiceName,
		payload.EnvironmentName,
		payload.Version,
		payload.Status,
		payload.StartedAt,
		payload.FinishedAt,
		payload.GitSHA,
		payload.GitBranch,
		payload.GitRepository,
		payload.GitActor,
		payload.CommitMessage,
		payload.ExternalURL,
		payload.Metadata,
	); err != nil {
		service.logger.ErrorContext(ctx, "CreateDeployment: failed to insert deployment", slog.Any("error", err))
		return "", ErrInternal
	}

	const markFirstReceived = `
UPDATE app
SET deployments_first_received_at = NOW()
WHERE id = $1
  AND deployments_first_received_at IS NULL
`

	if _, err := service.store.Pool().Exec(ctx, markFirstReceived, appID); err != nil {
		service.logger.ErrorContext(ctx, "CreateDeployment: failed to update first received timestamp", slog.Any("error", err))
		return "", ErrInternal
	}

	return id, nil
}

func (service *DeploymentService) updateDeployment(ctx context.Context, appID string, deploymentID string, payload validatedUpdateDeployment) AppError {
	service.logger.InfoContext(ctx, "UpdateDeployment: updating deployment", slog.String("app_id", appID), slog.String("deployment_id", deploymentID))

	const updateDeployment = `
UPDATE deployment
SET
	status = COALESCE($3, status),
	finished_at = COALESCE($4, finished_at),
	external_url = COALESCE($5, external_url),
	metadata = COALESCE($6, metadata)
WHERE id = $1
  AND app_id = $2
`

	commandTag, err := service.store.Pool().Exec(
		ctx,
		updateDeployment,
		deploymentID,
		appID,
		payload.Status,
		payload.FinishedAt,
		payload.ExternalURL,
		payload.Metadata,
	)
	if err != nil {
		service.logger.ErrorContext(ctx, "UpdateDeployment: failed to update deployment", slog.Any("error", err))
		return ErrInternal
	}

	if commandTag.RowsAffected() == 0 {
		return ErrDeploymentNotFound
	}

	return nil
}

func validateCreateDeployment(payload createDeploymentRequest) (*validatedCreateDeployment, AppError) {
	serviceName := trimOptional(payload.ServiceName)
	environmentName := trimOptional(payload.EnvironmentName)
	status := trimOptional(payload.Status)
	if status == "" {
		status = "succeeded"
	}

	if serviceName == "" || environmentName == "" || !isValidDeploymentStatus(status) {
		return nil, ErrInvalidDeploymentPayload
	}

	startedAt := time.Now().UTC()
	if payload.StartedAt != "" {
		parsed, err := time.Parse(time.RFC3339, payload.StartedAt)
		if err != nil {
			return nil, ErrInvalidDeploymentPayload
		}
		startedAt = parsed
	}

	var finishedAt *time.Time
	if payload.FinishedAt != "" {
		parsed, err := time.Parse(time.RFC3339, payload.FinishedAt)
		if err != nil {
			return nil, ErrInvalidDeploymentPayload
		}
		if parsed.Before(startedAt) {
			return nil, ErrInvalidDeploymentPayload
		}
		finishedAt = &parsed
	}

	metadata, err := marshalMetadata(payload.Metadata)
	if err != nil {
		return nil, ErrInvalidDeploymentPayload
	}

	return &validatedCreateDeployment{
		ServiceName:     serviceName,
		EnvironmentName: environmentName,
		Version:         stringPtr(payload.Version, 255),
		Status:          status,
		StartedAt:       startedAt,
		FinishedAt:      finishedAt,
		GitSHA:          stringPtr(payload.GitSHA, 255),
		GitBranch:       stringPtr(payload.GitBranch, 255),
		GitRepository:   stringPtr(payload.GitRepository, 255),
		GitActor:        stringPtr(payload.GitActor, 255),
		CommitMessage:   stringPtr(payload.CommitMessage, 2000),
		ExternalURL:     urlPtr(payload.ExternalURL, 2000),
		Metadata:        metadata,
	}, nil
}

func validateUpdateDeployment(payload updateDeploymentRequest) (*validatedUpdateDeployment, AppError) {
	status := trimOptional(payload.Status)
	if status != "" && !isValidDeploymentStatus(status) {
		return nil, ErrInvalidDeploymentPayload
	}

	var finishedAt *time.Time
	if payload.FinishedAt != "" {
		parsed, err := time.Parse(time.RFC3339, payload.FinishedAt)
		if err != nil {
			return nil, ErrInvalidDeploymentPayload
		}
		finishedAt = &parsed
	}

	var metadata []byte
	if payload.Metadata != nil {
		bytes, err := marshalMetadata(payload.Metadata)
		if err != nil {
			return nil, ErrInvalidDeploymentPayload
		}
		metadata = bytes
	}

	return &validatedUpdateDeployment{
		Status:      emptyToNil(status),
		FinishedAt:  finishedAt,
		ExternalURL: urlPtr(payload.ExternalURL, 2000),
		Metadata:    metadata,
	}, nil
}

func marshalMetadata(metadata map[string]any) ([]byte, error) {
	if metadata == nil {
		return []byte("{}"), nil
	}

	return json.Marshal(metadata)
}

func isValidDeploymentStatus(status string) bool {
	_, ok := deploymentStatuses[status]
	return ok
}

func trimOptional(value string) string {
	return strings.TrimSpace(value)
}

func emptyToNil(value string) *string {
	if value == "" {
		return nil
	}

	return &value
}

func stringPtr(value string, limit int) *string {
	trimmed := strings.TrimSpace(value)
	if trimmed == "" {
		return nil
	}

	if len(trimmed) > limit {
		trimmed = trimmed[:limit]
	}

	return &trimmed
}

func urlPtr(value string, limit int) *string {
	trimmed := strings.TrimSpace(value)
	if trimmed == "" {
		return nil
	}

	if !strings.HasPrefix(trimmed, "http://") && !strings.HasPrefix(trimmed, "https://") {
		return nil
	}

	if len(trimmed) > limit {
		trimmed = trimmed[:limit]
	}

	return &trimmed
}

func writeJSON(writer http.ResponseWriter, status int, value any) {
	writer.Header().Set("Content-Type", contentTypeJSON)
	writer.WriteHeader(status)
	_ = json.NewEncoder(writer).Encode(value)
}

func deploymentIDFromPath(path string) (string, error) {
	path = strings.TrimPrefix(path, "/v1/deployments/")
	path = strings.Trim(path, "/")
	if path == "" || strings.Contains(path, "/") {
		return "", fmt.Errorf("invalid deployment path")
	}

	return path, nil
}
