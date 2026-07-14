.DEFAULT_GOAL := help

DEPLOY_DIR := deploy
COMPOSE := docker compose --project-directory $(DEPLOY_DIR) -f $(DEPLOY_DIR)/docker-compose.yaml

# 加载部署环境变量，并为未配置的本地环境提供与 Compose 一致的默认值。
-include $(DEPLOY_DIR)/.env
DOCKER_REGISTRY ?= v2ai
IMAGE_PREFIX ?= remove-ai-flavor
IMAGE_SUFFIX ?=
VERSION ?= latest
CONTAINER_PREFIX ?= remove-ai-flavor
CONTAINER_SUFFIX ?=
ENV ?= prod
export

API_IMAGE := $(DOCKER_REGISTRY)/$(IMAGE_PREFIX)-api$(IMAGE_SUFFIX)
WEB_IMAGE := $(DOCKER_REGISTRY)/$(IMAGE_PREFIX)-web$(IMAGE_SUFFIX)

.PHONY: help dev-web dev-api build-api build-web build-all push-api push-web push-all run-api run-web run-all \
	build-push-all build-push-api build-push-web lint-md lint-md-fix format-md start stop logs restart rebuild deploy deploy-ci

## 显示根目录可用命令。
help:
	@echo "Remove AI Flavor - 开发与部署命令"
	@echo ""
	@echo "开发:"
	@echo "  make dev-web   启动 Next.js 前端开发服务器"
	@echo "  make dev-api   启动 FastAPI 后端开发服务器"
	@echo "  make lint-md   检查仓库 Markdown 文档"
	@echo ""
	@echo "部署:"
	@echo "  make build-api | build-web | build-all"
	@echo "  make push-api  | push-web  | push-all"
	@echo "  make start | stop | logs | restart | rebuild | deploy"
	@echo "  make deploy-ci 执行迁移、健康检查和无交互部署"

## 在 web 目录中启动前端开发服务器。
dev-web:
	pnpm --dir web dev

## 在 api 目录中启动后端开发服务器。
dev-api:
	cd api && uv run python -m app.main

## 使用临时工具检查仓库 Markdown 文档，无需安装根目录 Node.js 依赖。
lint-md:
	pnpm dlx markdownlint-cli@0.39.0 '**/*.md' --ignore node_modules --ignore web/node_modules --ignore api/app/skills/stop-slop

## 自动修复仓库 Markdown 文档格式。
lint-md-fix:
	pnpm dlx markdownlint-cli@0.39.0 '**/*.md' --ignore node_modules --ignore web/node_modules --ignore api/app/skills/stop-slop --fix

## 使用临时工具统一格式化仓库 Markdown 文档。
format-md:
	pnpm dlx prettier@3.2.5 --write '**/*.md' --ignore-path .gitignore --ignore-path .prettierignore

## 构建 API Docker 镜像。
build-api:
	@echo "Building API Docker image: $(API_IMAGE):$(VERSION)..."
	docker build -t $(API_IMAGE):$(VERSION) api
	@echo "API Docker image built successfully: $(API_IMAGE):$(VERSION)"

## 构建 Web Docker 镜像并注入公开的前端环境变量。
build-web:
	@echo "Building web Docker image: $(WEB_IMAGE):$(VERSION)..."
	@echo "Using NEXT_PUBLIC_DOCS_URL: $(NEXT_PUBLIC_DOCS_URL)"
	@echo "Using NEXT_PUBLIC_API_URL: $(NEXT_PUBLIC_API_URL)"
	@echo "Using NEXT_PUBLIC_APP_URL: $(NEXT_PUBLIC_APP_URL)"
	docker build \
		--build-arg NEXT_PUBLIC_DOCS_URL=$(NEXT_PUBLIC_DOCS_URL) \
		--build-arg NEXT_PUBLIC_API_URL=$(NEXT_PUBLIC_API_URL) \
		--build-arg NEXT_PUBLIC_APP_URL=$(NEXT_PUBLIC_APP_URL) \
		-t $(WEB_IMAGE):$(VERSION) web
	@echo "Web Docker image built successfully: $(WEB_IMAGE):$(VERSION)"

## 构建全部 Docker 镜像。
build-all: build-api build-web

## 推送 API Docker 镜像。
push-api:
	@echo "Pushing API Docker image: $(API_IMAGE):$(VERSION)..."
	docker push $(API_IMAGE):$(VERSION)
	@echo "API Docker image pushed successfully: $(API_IMAGE):$(VERSION)"

## 推送 Web Docker 镜像。
push-web:
	@echo "Pushing web Docker image: $(WEB_IMAGE):$(VERSION)..."
	docker push $(WEB_IMAGE):$(VERSION)
	@echo "Web Docker image pushed successfully: $(WEB_IMAGE):$(VERSION)"

## 推送全部 Docker 镜像。
push-all: push-api push-web

## 使用独立容器运行 API 镜像。
run-api:
	@echo "Running API Docker image: $(API_IMAGE):$(VERSION)..."
	docker rm -f $(CONTAINER_PREFIX)-api$(CONTAINER_SUFFIX)
	docker run -d -p 8000:8000 --name $(CONTAINER_PREFIX)-api$(CONTAINER_SUFFIX) \
		-v $(CURDIR)/api/.env:/app/api/.env $(API_IMAGE):$(VERSION)
	@echo "API Docker image running successfully: $(API_IMAGE):$(VERSION)"

## 使用独立容器运行 Web 镜像。
run-web:
	@echo "Running web Docker image: $(WEB_IMAGE):$(VERSION)..."
	docker rm -f $(CONTAINER_PREFIX)-web$(CONTAINER_SUFFIX)
	docker run -d -p 3000:3000 --name $(CONTAINER_PREFIX)-web$(CONTAINER_SUFFIX) \
		-v $(CURDIR)/web/.env:/app/web/.env $(WEB_IMAGE):$(VERSION)
	@echo "Web Docker image running successfully: $(WEB_IMAGE):$(VERSION)"

## 运行全部独立 Docker 容器。
run-all: run-api run-web

## 构建并推送全部 Docker 镜像。
build-push-all: build-all push-all
	@echo "All Docker images have been built and pushed."

## 构建并推送指定应用镜像。
build-push-api: build-api push-api
build-push-web: build-web push-web

## 启动全部 Compose 服务。
start:
	@echo "Starting all services in $(ENV) environment..."
	$(COMPOSE) up -d
	@echo "All services started successfully!"

## 停止并移除全部 Compose 服务。
stop:
	@echo "Stopping all services in $(ENV) environment..."
	$(COMPOSE) down
	@echo "All services stopped successfully!"

## 持续查看全部 Compose 服务日志。
logs:
	@echo "Viewing logs for all services..."
	$(COMPOSE) logs -f

## 重启服务并持续查看日志。
restart: stop start logs

## 停止、重新构建并启动服务。
rebuild: stop build-all start logs

## 构建镜像并重启服务。
deploy: build-all restart

## 执行适合 CI 的无交互部署流程，包括迁移与健康检查。
deploy-ci:
	@echo "Building images for CI deployment..."
	@$(MAKE) build-all
	@$(MAKE) stop
	@echo "Starting PostgreSQL and Redis..."
	$(COMPOSE) up -d --wait --wait-timeout 120 postgres redis
	@echo "Applying database migrations..."
	$(COMPOSE) run --rm --no-deps --entrypoint alembic api upgrade head || { \
		echo "Database migration failed; collecting diagnostics..."; \
		$(COMPOSE) ps || true; \
		$(COMPOSE) logs --tail=200 postgres || true; \
		exit 1; \
	}
	@echo "Starting application services and waiting for health checks..."
	$(COMPOSE) up -d --wait --wait-timeout 180 || { \
		echo "Deployment failed; collecting diagnostics..."; \
		$(COMPOSE) ps || true; \
		$(COMPOSE) logs --tail=200 api nginx || true; \
		exit 1; \
	}
	$(COMPOSE) exec -T api wget -qO- http://127.0.0.1:8000/health
	$(COMPOSE) ps
	@echo "Pruning dangling images and build cache..."
	docker image prune -f || true
	docker builder prune -f || true
