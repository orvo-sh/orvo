package ingestservice

import (
	"strings"

	"github.com/orvo-sh/orvo/apps/ingest/internal/domain/models"
	"github.com/orvo-sh/orvo/apps/ingest/pkg/chutil"
)

type metricIdentity struct {
	EntityKind         string
	HostID             string
	HostName           string
	HostArch           string
	OSType             string
	ContainerID        string
	ContainerName      string
	ContainerImageName string
}

func resolveMetricIdentity(point models.MetricPoint) metricIdentity {
	resourceAttributes := chutil.NormalizeStringMap(point.ResourceAttributes)

	identity := metricIdentity{
		EntityKind:         "application",
		HostID:             resourceAttributes["host.id"],
		HostName:           firstNonEmpty(resourceAttributes["host.name"], resourceAttributes["host.hostname"]),
		HostArch:           resourceAttributes["host.arch"],
		OSType:             resourceAttributes["os.type"],
		ContainerID:        resourceAttributes["container.id"],
		ContainerName:      strings.TrimPrefix(resourceAttributes["container.name"], "/"),
		ContainerImageName: resourceAttributes["container.image.name"],
	}

	if strings.HasPrefix(point.MetricName, "system.") {
		identity.EntityKind = "host"
		return identity
	}

	if strings.HasPrefix(point.MetricName, "container.") {
		identity.EntityKind = "container"
		if identity.ContainerID == "" {
			identity.ContainerID = resourceAttributes["container.runtime.id"]
		}
		return identity
	}

	return identity
}

func firstNonEmpty(values ...string) string {
	for _, value := range values {
		if value != "" {
			return value
		}
	}

	return ""
}
