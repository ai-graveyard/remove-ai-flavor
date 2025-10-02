# 部署指南

本目录支持通过 `.env` 文件配置不同的部署环境(生产环境、测试环境等)。

## 快速开始

### 1. 选择环境配置

根据你要部署的环境,复制对应的配置文件:

```bash
# 生产环境
cp .env.example .env

# 测试环境
cp .env.test.example .env
```

### 2. 修改配置

编辑 `.env` 文件,填入你的实际配置:

```bash
# 必须修改的配置
AUTH_SECRET_KEY=your_secure_secret_key_here
POSTGRES_PASSWORD=your_secure_password_here
REDIS_PASSWORD=your_secure_redis_password_here
AGENT_API_KEY=sk-proj-xxxxx
STRIPE_PRIVATE_KEY=sk_live_xxxxx
STRIPE_WEBHOOK_SECRET=whsec_xxxxx
MAIL_PASSWORD=your_mail_password_here
```

### 3. 启动服务

```bash
# 启动所有服务
make start

# 查看日志
make logs

# 停止服务
make stop

# 重启服务
make restart

# 重新构建并启动
make rebuild
```

## 环境配置说明

### 关键环境变量

| 变量 | 说明 | 生产环境 | 测试环境 |
|------|------|----------|----------|
| `ENV` | 环境标识 | `prod` | `test` |
| `IMAGE_SUFFIX` | 镜像名后缀 | 空 | `-test` |
| `CONTAINER_SUFFIX` | 容器名后缀 | 空 | `-test` |
| `NETWORK_NAME` | Docker 网络名 | `remove-ai-flavor-network` | `remove-ai-flavor-network-test` |
| `NGINX_PORT` | Nginx 对外端口 | `8081` | `8081` |
| `POSTGRES_EXPOSE_PORT` | PostgreSQL 对外端口 | `15432` | `15433` |
| `REDIS_EXPOSE_PORT` | Redis 对外端口 | `16379` | `16380` |

### 镜像命名规则

- **生产环境**: `v2ai/remove-ai-flavor-api:latest`
- **测试环境**: `v2ai/remove-ai-flavor-api-test:latest`

### 容器命名规则

- **生产环境**: `remove-ai-flavor-api`
- **测试环境**: `remove-ai-flavor-api-test`

## 多环境同时运行

由于容器名、网络名和端口都通过 `.env` 配置,你可以在同一台服务器上同时运行生产和测试环境:

```bash
# 在 deploy 目录创建两个子目录
mkdir -p prod test

# 复制配置到各自目录
cp docker-compose.yaml nginx/default.conf makefile prod/
cp docker-compose.yaml nginx/default.conf makefile test/
cp .env.prod prod/.env
cp .env.test test/.env

# 分别启动
cd prod && make start
cd ../test && make start
```

## 构建和推送镜像

```bash
# 构建所有镜像
make build-all

# 推送所有镜像
make push-all

# 构建并推送
make build-push-all

# 单独构建和推送
make build-push-api
make build-push-web
make build-push-docs
```

## 常见问题

### 1. 端口冲突

如果遇到端口冲突,修改 `.env` 中的端口配置:

```bash
NGINX_PORT=8082
POSTGRES_EXPOSE_PORT=15434
REDIS_EXPOSE_PORT=16381
```

### 2. 数据持久化

数据存储在 `volumes/` 目录下:

```
deploy/
├── volumes/
│   ├── db/data/      # PostgreSQL 数据
│   └── redis/data/   # Redis 数据
```

### 3. 网络隔离

不同环境使用不同的 Docker 网络,互不干扰:

- 生产环境: `remove-ai-flavor-network`
- 测试环境: `remove-ai-flavor-network-test`

## 安全建议

1. **永远不要提交 `.env` 文件到 Git**
2. **使用强密码** - 特别是 `AUTH_SECRET_KEY`, `POSTGRES_PASSWORD`, `REDIS_PASSWORD`
3. **生产环境关闭调试模式** - 设置 `AUTH_IS_DEBUG=False`, `API_RELOAD=False`
4. **定期备份数据库** - 备份 `volumes/db/data` 目录
5. **使用 HTTPS** - 在 Nginx 配置中启用 SSL/TLS

## 健康检查

服务启动后,可以通过以下 URL 检查服务状态:

```bash
# API 健康检查
curl http://localhost:8081/api/v1/health

# 查看所有容器状态
docker compose ps
```

## 日志管理

```bash
# 查看所有服务日志
make logs

# 查看特定服务日志
docker compose logs -f api
docker compose logs -f web
docker compose logs -f postgres
```
