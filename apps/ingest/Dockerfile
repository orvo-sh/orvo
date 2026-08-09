FROM golang:1.24.5 AS builder

WORKDIR /src

COPY go.mod go.sum ./
RUN go mod download

COPY . .
ARG TARGETOS=linux
ARG TARGETARCH
RUN CGO_ENABLED=0 GOOS=$TARGETOS GOARCH=$TARGETARCH go build -o /out/ingest ./cmd/ingest

FROM gcr.io/distroless/base-debian12

COPY --from=builder /out/ingest /ingest

EXPOSE 4318

ENTRYPOINT ["/ingest"]
