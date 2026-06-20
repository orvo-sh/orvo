package middleware

import (
	"context"
	"net/http"
	"strings"

	"github.com/orvo-sh/orvo/apps/ingest/internal/domain/errs"
	"github.com/orvo-sh/orvo/apps/ingest/internal/domain/models"
	"github.com/orvo-sh/orvo/apps/ingest/internal/domain/services/authservice"
	httphelpers "github.com/orvo-sh/orvo/apps/ingest/internal/http/helpers"
	"github.com/orvo-sh/orvo/apps/ingest/pkg/util"
)

type resolvedIngestionKeyContextKey struct{}

func NewIngestionKeyResolver(authService authservice.Service) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(writer http.ResponseWriter, request *http.Request) {
			authorization := request.Header.Get("Authorization")
			rawKey :=  util.Ternary(strings.HasPrefix(authorization, "Bearer "), strings.TrimSpace(strings.TrimPrefix(authorization, "Bearer ")), "")
			if rawKey == "" {
				httphelpers.WriteAppErr(writer, errs.ErrInvalidIngestionKey)
				return
			}

			resolved, appErr := authService.ResolveIngestionKey(request.Context(), rawKey)
			if appErr != nil {
				httphelpers.WriteAppErr(writer, appErr)
				return
			}

			next.ServeHTTP(writer, request.WithContext(context.WithValue(
				request.Context(),
				resolvedIngestionKeyContextKey{},
				*resolved,
			)))
		})
	}
}

func GetResolvedIngestionKey(ctx context.Context) (models.ResolvedIngestionKey, bool) {
	resolved, ok := ctx.Value(resolvedIngestionKeyContextKey{}).(models.ResolvedIngestionKey)
	return resolved, ok
}

