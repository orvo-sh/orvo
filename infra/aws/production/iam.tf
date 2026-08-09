locals {
  instance_roles = toset(["app", "postgres", "clickhouse"])
}

resource "aws_iam_role" "instance" {
  for_each = local.instance_roles

  name = "orvo-prod-${each.key}"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect = "Allow"
      Principal = {
        Service = "ec2.amazonaws.com"
      }
      Action = "sts:AssumeRole"
    }]
  })
}

resource "aws_iam_role_policy_attachment" "ssm" {
  for_each = local.instance_roles

  role       = aws_iam_role.instance[each.key].name
  policy_arn = "arn:aws:iam::aws:policy/AmazonSSMManagedInstanceCore"
}

resource "aws_iam_role_policy_attachment" "cloudwatch" {
  for_each = local.instance_roles

  role       = aws_iam_role.instance[each.key].name
  policy_arn = "arn:aws:iam::aws:policy/CloudWatchAgentServerPolicy"
}

resource "aws_iam_instance_profile" "instance" {
  for_each = local.instance_roles

  name = "orvo-prod-${each.key}"
  role = aws_iam_role.instance[each.key].name
}

resource "aws_iam_role_policy" "database_backups" {
  for_each = toset(["postgres", "clickhouse"])

  name = "orvo-prod-${each.key}-backups"
  role = aws_iam_role.instance[each.key].id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect   = "Allow"
        Action   = ["s3:ListBucket"]
        Resource = [aws_s3_bucket.backups.arn]
        Condition = {
          StringLike = {
            "s3:prefix" = ["${each.key}/*"]
          }
        }
      },
      {
        Effect = "Allow"
        Action = [
          "s3:AbortMultipartUpload",
          "s3:DeleteObject",
          "s3:GetObject",
          "s3:ListMultipartUploadParts",
          "s3:PutObject"
        ]
        Resource = ["${aws_s3_bucket.backups.arn}/${each.key}/*"]
      }
    ]
  })
}
