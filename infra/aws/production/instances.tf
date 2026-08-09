resource "random_password" "postgres" {
  length  = 32
  special = false
}

resource "random_password" "clickhouse" {
  length  = 32
  special = false
}

resource "aws_key_pair" "production" {
  key_name   = "orvo-production"
  public_key = file(pathexpand(var.ssh_public_key_path))
}

resource "aws_instance" "app" {
  ami                         = data.aws_ami.ubuntu_arm64.id
  instance_type               = var.app_instance_type
  availability_zone           = var.availability_zone
  subnet_id                   = data.aws_subnet.default.id
  associate_public_ip_address = true
  key_name                    = aws_key_pair.production.key_name
  vpc_security_group_ids      = [aws_security_group.app.id]
  iam_instance_profile        = aws_iam_instance_profile.instance["app"].name

  metadata_options {
    http_endpoint = "enabled"
    http_tokens   = "required"
  }

  root_block_device {
    encrypted   = true
    volume_type = "gp3"
    volume_size = 16
  }

  user_data = file("${path.module}/user-data/app.sh")

  tags = { Name = "orvo-prod-app" }
}

resource "aws_instance" "postgres" {
  ami                         = data.aws_ami.ubuntu_arm64.id
  instance_type               = var.postgres_instance_type
  availability_zone           = var.availability_zone
  subnet_id                   = data.aws_subnet.default.id
  associate_public_ip_address = true
  key_name                    = aws_key_pair.production.key_name
  vpc_security_group_ids      = [aws_security_group.postgres.id]
  iam_instance_profile        = aws_iam_instance_profile.instance["postgres"].name

  metadata_options {
    http_endpoint = "enabled"
    http_tokens   = "required"
  }

  root_block_device {
    encrypted   = true
    volume_type = "gp3"
    volume_size = 12
  }

  user_data = templatefile("${path.module}/user-data/postgres.sh.tftpl", {
    backup_bucket     = aws_s3_bucket.backups.id
    data_volume_id    = aws_ebs_volume.postgres_data.id
    postgres_password = random_password.postgres.result
    region            = var.aws_region
  })

  tags = { Name = "orvo-prod-postgres" }
}

resource "aws_instance" "clickhouse" {
  ami                         = data.aws_ami.ubuntu_arm64.id
  instance_type               = var.clickhouse_instance_type
  availability_zone           = var.availability_zone
  subnet_id                   = data.aws_subnet.default.id
  associate_public_ip_address = true
  key_name                    = aws_key_pair.production.key_name
  vpc_security_group_ids      = [aws_security_group.clickhouse.id]
  iam_instance_profile        = aws_iam_instance_profile.instance["clickhouse"].name

  metadata_options {
    http_endpoint               = "enabled"
    http_put_response_hop_limit = 2
    http_tokens                 = "required"
  }

  root_block_device {
    encrypted   = true
    volume_type = "gp3"
    volume_size = 16
  }

  user_data = templatefile("${path.module}/user-data/clickhouse.sh.tftpl", {
    backup_bucket       = aws_s3_bucket.backups.id
    clickhouse_password = random_password.clickhouse.result
    data_volume_id      = aws_ebs_volume.clickhouse_data.id
    region              = var.aws_region
  })

  tags = { Name = "orvo-prod-clickhouse" }
}

resource "aws_volume_attachment" "postgres_data" {
  device_name = "/dev/sdf"
  volume_id   = aws_ebs_volume.postgres_data.id
  instance_id = aws_instance.postgres.id
}

resource "aws_volume_attachment" "clickhouse_data" {
  device_name = "/dev/sdf"
  volume_id   = aws_ebs_volume.clickhouse_data.id
  instance_id = aws_instance.clickhouse.id
}

resource "aws_eip" "app" {
  domain = "vpc"

  tags = { Name = "orvo-prod-app" }
}

resource "aws_eip_association" "app" {
  allocation_id = aws_eip.app.id
  instance_id   = aws_instance.app.id
}
