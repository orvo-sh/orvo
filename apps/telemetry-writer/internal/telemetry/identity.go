package telemetry

import "strings"

type MetricIdentity struct {
	EntityKind         string
	HostID             string
	HostName           string
	HostArch           string
	OSType             string
	ContainerID        string
	ContainerName      string
	ContainerImageName string
}

func ResolveMetricIdentity(point MetricPoint) MetricIdentity {
	resourceAttributes := NormalizeStringMap(point.ResourceAttributes)

	identity := MetricIdentity{
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
