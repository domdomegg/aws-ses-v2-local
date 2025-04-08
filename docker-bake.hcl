variable "VERSION" {
  default = "latest"
}

variable "IMAGE_NAME" {
  default = "aws-ses-v2-local"
}

variable "USERNAME" {
  default = "aws-ses-v2-local"
}

variable "REPOSITORY_URL" {
  default = "https://github.com/dertdog/aws-ses-v2-local"
}

target "base" {
  dockerfile = "Dockerfile"
  tags = ["docker.io/${USERNAME}/${IMAGE_NAME}:${VERSION}"]
  context = "."
}

target "default"{
  inherits = ["base"]
  platforms = ["linux/amd64", "linux/arm64"]
}

target "local"{
  inherits = ["base"]
  platforms = ["linux/amd64"]
  tags = ["${USERNAME}/${IMAGE_NAME}:${VERSION}"]
}
