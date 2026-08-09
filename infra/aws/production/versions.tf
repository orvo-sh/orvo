terraform {
  required_version = ">= 1.12.0"

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 6.0"
    }
    random = {
      source  = "hashicorp/random"
      version = "~> 3.7"
    }
  }

  backend "s3" {
    bucket       = "orvo-opentofu-state-518902362990-eu-central-1"
    key          = "production/infrastructure.tfstate"
    region       = "eu-central-1"
    profile      = "orvo-admin"
    encrypt      = true
    use_lockfile = true
  }
}
