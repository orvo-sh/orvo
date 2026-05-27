FROM golang:1.24.5 AS builder

WORKDIR /src

COPY go.mod go.sum ./
RUN go mod download

COPY . .
RUN CGO_ENABLED=0 GOOS=linux GOARCH=amd64 go build -o /out/telemetry-writer .

FROM gcr.io/distroless/base-debian12

COPY --from=builder /out/telemetry-writer /telemetry-writer

ENTRYPOINT ["/telemetry-writer"]
