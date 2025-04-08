VERSION=local
IMAGE_NAME=aws-ses-v2-local

.PHONY: build-docker
build-docker: ## build a multi-architecture image to test locally
	@VERSION=$(VERSION) docker buildx bake -f docker-bake.hcl local --load
	@echo "IMAGE: $(IMAGE_NAME):$(VERSION)"
