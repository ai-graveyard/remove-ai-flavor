.DEFAULT_GOAL := help

.PHONY: help dev-web dev-api build-api build-web build-all push-api push-web push-all start stop logs restart rebuild deploy deploy-ci

## 显示根目录可用命令。
help:
	@echo "Remove AI Flavor - 开发与部署命令"
	@echo ""
	@echo "开发:"
	@echo "  make dev-web   启动 Next.js 前端开发服务器"
	@echo "  make dev-api   启动 FastAPI 后端开发服务器"
	@echo ""
	@echo "部署:"
	@echo "  make build-api | build-web | build-all"
	@echo "  make push-api  | push-web  | push-all"
	@echo "  make start | stop | logs | restart | rebuild | deploy"
	@echo "  make deploy-ci 由 CI 拉取最新代码并执行无交互部署"

## 在 web 目录中启动前端开发服务器。
dev-web:
	pnpm --dir web dev

## 在 api 目录中启动后端开发服务器。
dev-api:
	cd api && uv run python -m app.main

## 将部署命令转发到 deploy/Makefile。
build-api build-web build-all push-api push-web push-all start stop logs restart rebuild deploy:
	$(MAKE) -C deploy $@

## 拉取 main 分支最新代码，并执行适合 CI 的无交互部署。
deploy-ci:
	git pull --ff-only
	$(MAKE) -C deploy deploy-ci
