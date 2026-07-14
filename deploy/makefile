# Variables
DOCKER_REGISTRY=${DOCKER_REGISTRY}
IMAGE_PREFIX=${IMAGE_PREFIX}
IMAGE_SUFFIX=${IMAGE_SUFFIX}
API_IMAGE=$(DOCKER_REGISTRY)/$(IMAGE_PREFIX)-api$(IMAGE_SUFFIX)
WEB_IMAGE=$(DOCKER_REGISTRY)/$(IMAGE_PREFIX)-web$(IMAGE_SUFFIX)
VERSION=${VERSION}

# 包含 .env 文件(如果存在)
-include .env
export

# Build Docker images
build-api:
	@echo "Building API Docker image: $(API_IMAGE):$(VERSION)..."
	docker build -t $(API_IMAGE):$(VERSION) ../api
	@echo "API Docker image built successfully: $(API_IMAGE):$(VERSION)"

build-web:
	@echo "Building web Docker image: $(WEB_IMAGE):$(VERSION)..."
	@echo "Using NEXT_PUBLIC_DOCS_URL: $(NEXT_PUBLIC_DOCS_URL)"
	@echo "Using NEXT_PUBLIC_API_URL: $(NEXT_PUBLIC_API_URL)"
	docker build \
		--build-arg NEXT_PUBLIC_DOCS_URL=$(NEXT_PUBLIC_DOCS_URL) \
		--build-arg NEXT_PUBLIC_API_URL=$(NEXT_PUBLIC_API_URL) \
		-t $(WEB_IMAGE):$(VERSION) ../web
	@echo "Web Docker image built successfully: $(WEB_IMAGE):$(VERSION)"

# Push Docker images
push-api:
	@echo "Pushing API Docker image: $(API_IMAGE):$(VERSION)..."
	docker push $(API_IMAGE):$(VERSION)
	@echo "API Docker image pushed successfully: $(API_IMAGE):$(VERSION)"

push-web:
	@echo "Pushing web Docker image: $(WEB_IMAGE):$(VERSION)..."
	docker push $(WEB_IMAGE):$(VERSION)
	@echo "Web Docker image pushed successfully: $(WEB_IMAGE):$(VERSION)"

# Run Docker images
run-api:
	@echo "Running API Docker image: $(API_IMAGE):$(VERSION)..."
	docker rm -f $(CONTAINER_PREFIX)-api$(CONTAINER_SUFFIX)
	docker run -d -p 8000:8000 --name $(CONTAINER_PREFIX)-api$(CONTAINER_SUFFIX) -v $(PWD)/../api/.env:/app/api/.env $(API_IMAGE):$(VERSION)
	@echo "API Docker image running successfully: $(API_IMAGE):$(VERSION)"

run-web:
	@echo "Running web Docker image: $(WEB_IMAGE):$(VERSION)..."
	docker rm -f $(CONTAINER_PREFIX)-web$(CONTAINER_SUFFIX)
	docker run -d -p 3000:3000 --name $(CONTAINER_PREFIX)-web$(CONTAINER_SUFFIX) -v $(PWD)/../web/.env:/app/web/.env $(WEB_IMAGE):$(VERSION)
	@echo "Web Docker image running successfully: $(WEB_IMAGE):$(VERSION)"

# Build all images
build-all: build-api build-web

# Push all images
push-all: push-api push-web

# Run all images
run-all: run-api run-web

# Build and push all images
build-push-all: build-all push-all
	@echo "All Docker images have been built and pushed."

# Build and push images
build-push-api: build-api push-api
build-push-web: build-web push-web

start:
	@echo "Starting all services in $(ENV) environment..."
	docker compose up -d
	@echo "All services started successfully!"

stop:
	@echo "Stopping all services in $(ENV) environment..."
	docker compose down
	@echo "All services stopped successfully!"

logs:
	@echo "Viewing logs for all services..."
	docker compose logs -f

restart: stop start logs

rebuild: stop build-all start logs

deploy: build-all restart

# 供 CI 使用的无交互部署流程：构建镜像、执行迁移并等待服务健康。
deploy-ci:
	@echo "Building images for CI deployment..."
	@$(MAKE) build-all
	@$(MAKE) stop
	@echo "Starting PostgreSQL and Redis..."
	docker compose up -d --wait --wait-timeout 120 postgres redis
	@echo "Applying database migrations..."
	docker compose run --rm --no-deps --entrypoint alembic api upgrade head || { \
		echo "Database migration failed; collecting diagnostics..."; \
		docker compose ps || true; \
		docker compose logs --tail=200 postgres || true; \
		exit 1; \
	}
	@echo "Starting application services and waiting for health checks..."
	docker compose up -d --wait --wait-timeout 180 || { \
		echo "Deployment failed; collecting diagnostics..."; \
		docker compose ps || true; \
		docker compose logs --tail=200 api nginx || true; \
		exit 1; \
	}
	docker compose exec -T api wget -qO- http://127.0.0.1:8000/health
	docker compose ps
	@echo "Pruning dangling images and build cache..."
	docker image prune -f || true
	docker builder prune -f || true

# Phony targets
.PHONY: build-web build-api push-web push-api build-all push-all build-push-all build-push-web start stop logs restart rebuild deploy deploy-ci
