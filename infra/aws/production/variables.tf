variable "aws_profile" {
  type    = string
  default = "orvo-admin"
}

variable "aws_region" {
  type    = string
  default = "eu-central-1"
}

variable "availability_zone" {
  type    = string
  default = "eu-central-1a"
}

variable "admin_cidr" {
  type        = string
  description = "Public administrator IPv4 address in CIDR notation."
}

variable "ssh_public_key_path" {
  type    = string
  default = "~/.ssh/orvo-prod-key.pub"
}

variable "app_instance_type" {
  type    = string
  default = "t4g.small"
}

variable "postgres_instance_type" {
  type    = string
  default = "t4g.small"
}

variable "clickhouse_instance_type" {
  type    = string
  default = "t4g.medium"
}
