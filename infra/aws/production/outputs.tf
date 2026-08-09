output "app_elastic_ip" {
  value = aws_eip.app.public_ip
}

output "app_instance_id" {
  value = aws_instance.app.id
}

output "app_public_dns" {
  value = aws_instance.app.public_dns
}

output "postgres_instance_id" {
  value = aws_instance.postgres.id
}

output "postgres_public_ip" {
  value = aws_instance.postgres.public_ip
}

output "clickhouse_instance_id" {
  value = aws_instance.clickhouse.id
}

output "clickhouse_public_ip" {
  value = aws_instance.clickhouse.public_ip
}

output "backup_bucket" {
  value = aws_s3_bucket.backups.id
}

output "postgres_url" {
  value     = "postgresql://orvo:${urlencode(random_password.postgres.result)}@${aws_instance.postgres.private_ip}:5432/orvo?sslrootcert=/opt/orvo/certs/orvo-postgres-ca.crt&uselibpqcompat=true&sslmode=require"
  sensitive = true
}

output "clickhouse_url" {
  value     = "http://orvo:${urlencode(random_password.clickhouse.result)}@${aws_instance.clickhouse.private_ip}:8123/default"
  sensitive = true
}
