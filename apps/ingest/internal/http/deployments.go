package ingesthttp

import (
	"encoding/json"
	"net/http"
	"time"

	"github.com/orvo-sh/orvo/apps/ingest/internal/domain/errs"
	"github.com/orvo-sh/orvo/apps/ingest/internal/domain/services/authservice"
	"github.com/orvo-sh/orvo/apps/ingest/internal/domain/services/deploymentservice"
	"github.com/orvo-sh/orvo/apps/ingest/pkg/apperr"
)

var deploymentStatuses = map[string]struct{}{
	"pending":     {},
	"in_progress": {},
	"succeeded":   {},
	"failed":      {},
	"rolled_back": {},
}

type deploymentHandler struct {
	authService       authservice.Service
	deploymentService deploymentservice.Service
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

func (handler *deploymentHandler) handleCreate(writer http.ResponseWriter, request *http.Request) {
	if request.Method != http.MethodPost {
		writer.WriteHeader(http.StatusMethodNotAllowed)
		return
	}

	resolved, err := handler.authService.ResolveRequest(request)
	if err != nil {
		writeAppError(writer, errs.ErrInvalidIngestionKey)
		return
	}
	if resolved.Kind != "private" {
		writeAppError(writer, errs.ErrPrivateIngestionKeyRequired)
		return
	}

	var payload createDeploymentRequest
	decoder := json.NewDecoder(request.Body)
	decoder.DisallowUnknownFields()
	if err := decoder.Decode(&payload); err != nil {
		writeAppError(writer, errs.ErrMalformedPayload)
		return
	}

	input, appErr := validateCreateDeployment(payload)
	if appErr != nil {
		writeAppError(writer, appErr)
		return
	}

	id, appErr := handler.deploymentService.Create(request.Context(), resolved.AppID, input)
	if appErr != nil {
		writeAppError(writer, appErr)
		return
	}

	writeJSON(writer, http.StatusCreated, map[string]string{"id": id})
}

func (handler *deploymentHandler) handleUpdate(writer http.ResponseWriter, request *http.Request) {
	if request.Method != http.MethodPatch {
		writer.WriteHeader(http.StatusMethodNotAllowed)
		return
	}

	resolved, err := handler.authService.ResolveRequest(request)
	if err != nil {
		writeAppError(writer, errs.ErrInvalidIngestionKey)
		return
	}
	if resolved.Kind != "private" {
		writeAppError(writer, errs.ErrPrivateIngestionKeyRequired)
		return
	}

	deploymentID, err := pathValue(request.URL.Path, "/v1/deployments/")
	if err != nil {
		writeAppError(writer, errs.ErrDeploymentNotFound)
		return
	}

	var payload updateDeploymentRequest
	decoder := json.NewDecoder(request.Body)
	decoder.DisallowUnknownFields()
	if err := decoder.Decode(&payload); err != nil {
		writeAppError(writer, errs.ErrMalformedPayload)
		return
	}

	input, appErr := validateUpdateDeployment(payload)
	if appErr != nil {
		writeAppError(writer, appErr)
		return
	}

	if appErr := handler.deploymentService.Update(request.Context(), resolved.AppID, deploymentID, input); appErr != nil {
		writeAppError(writer, appErr)
		return
	}

	writeJSON(writer, http.StatusOK, map[string]bool{"ok": true})
}

func validateCreateDeployment(payload createDeploymentRequest) (deploymentservice.CreateInput, apperr.Error) {
	serviceName := trimOptional(payload.ServiceName)
	environmentName := trimOptional(payload.EnvironmentName)
	status := trimOptional(payload.Status)
	if status == "" {
		status = "succeeded"
	}
	if serviceName == "" || environmentName == "" || !isValidDeploymentStatus(status) {
		return deploymentservice.CreateInput{}, errs.ErrInvalidDeploymentPayload
	}

	startedAt := time.Now().UTC()
	if payload.StartedAt != "" {
		value, err := time.Parse(time.RFC3339, payload.StartedAt)
		if err != nil {
			return deploymentservice.CreateInput{}, errs.ErrInvalidDeploymentPayload
		}
		startedAt = value
	}

	var finishedAt *time.Time
	if payload.FinishedAt != "" {
		value, err := time.Parse(time.RFC3339, payload.FinishedAt)
		if err != nil || value.Before(startedAt) {
			return deploymentservice.CreateInput{}, errs.ErrInvalidDeploymentPayload
		}
		finishedAt = &value
	}

	metadata, err := marshalMetadata(payload.Metadata)
	if err != nil {
		return deploymentservice.CreateInput{}, errs.ErrInvalidDeploymentPayload
	}

	return deploymentservice.CreateInput{
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

func validateUpdateDeployment(payload updateDeploymentRequest) (deploymentservice.UpdateInput, apperr.Error) {
	status := trimOptional(payload.Status)
	if status != "" && !isValidDeploymentStatus(status) {
		return deploymentservice.UpdateInput{}, errs.ErrInvalidDeploymentPayload
	}

	var finishedAt *time.Time
	if payload.FinishedAt != "" {
		value, err := time.Parse(time.RFC3339, payload.FinishedAt)
		if err != nil {
			return deploymentservice.UpdateInput{}, errs.ErrInvalidDeploymentPayload
		}
		finishedAt = &value
	}

	var metadata []byte
	if payload.Metadata != nil {
		bytes, err := marshalMetadata(payload.Metadata)
		if err != nil {
			return deploymentservice.UpdateInput{}, errs.ErrInvalidDeploymentPayload
		}
		metadata = bytes
	}

	return deploymentservice.UpdateInput{
		Status:      stringPtr(status, 64),
		FinishedAt:  finishedAt,
		ExternalURL: urlPtr(payload.ExternalURL, 2000),
		Metadata:    metadata,
	}, nil
}

func isValidDeploymentStatus(value string) bool {
	_, ok := deploymentStatuses[value]
	return ok
}
