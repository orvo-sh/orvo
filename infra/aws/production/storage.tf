resource "aws_s3_bucket" "backups" {
  bucket = "orvo-production-backups-${data.aws_caller_identity.current.account_id}-${var.aws_region}"

  lifecycle {
    prevent_destroy = true
  }
}

resource "aws_s3_bucket_public_access_block" "backups" {
  bucket = aws_s3_bucket.backups.id

  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

resource "aws_s3_bucket_versioning" "backups" {
  bucket = aws_s3_bucket.backups.id

  versioning_configuration {
    status = "Enabled"
  }
}

resource "aws_s3_bucket_server_side_encryption_configuration" "backups" {
  bucket = aws_s3_bucket.backups.id

  rule {
    apply_server_side_encryption_by_default {
      sse_algorithm = "AES256"
    }
  }
}

resource "aws_s3_bucket_lifecycle_configuration" "backups" {
  bucket = aws_s3_bucket.backups.id

  rule {
    id     = "expire-database-backups"
    status = "Enabled"

    filter {}

    expiration {
      days = 35
    }

    noncurrent_version_expiration {
      noncurrent_days = 7
    }

    abort_incomplete_multipart_upload {
      days_after_initiation = 1
    }
  }
}

resource "aws_s3_bucket_policy" "backups" {
  bucket = aws_s3_bucket.backups.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Sid       = "DenyInsecureTransport"
      Effect    = "Deny"
      Principal = "*"
      Action    = "s3:*"
      Resource = [
        aws_s3_bucket.backups.arn,
        "${aws_s3_bucket.backups.arn}/*"
      ]
      Condition = {
        Bool = {
          "aws:SecureTransport" = "false"
        }
      }
    }]
  })
}

data "aws_route_tables" "default_vpc" {
  vpc_id = data.aws_vpc.default.id
}

resource "aws_vpc_endpoint" "s3" {
  vpc_id            = data.aws_vpc.default.id
  service_name      = "com.amazonaws.${var.aws_region}.s3"
  vpc_endpoint_type = "Gateway"
  route_table_ids   = data.aws_route_tables.default_vpc.ids

  tags = { Name = "orvo-prod-s3" }
}

resource "aws_ebs_volume" "postgres_data" {
  availability_zone = var.availability_zone
  encrypted         = true
  type              = "gp3"
  size              = 32

  tags = {
    Name   = "orvo-prod-postgres-data"
    Backup = "true"
  }

  lifecycle {
    prevent_destroy = true
  }
}

resource "aws_ebs_volume" "clickhouse_data" {
  availability_zone = var.availability_zone
  encrypted         = true
  type              = "gp3"
  size              = 64

  tags = {
    Name   = "orvo-prod-clickhouse-data"
    Backup = "true"
  }

  lifecycle {
    prevent_destroy = true
  }
}
