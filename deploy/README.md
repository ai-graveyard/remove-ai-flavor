# 部署指南

`deploy/` 使用 Docker Compose 运行 Web、API、Nginx、PostgreSQL、Redis 和 Stripe CLI。环境差异由 `.env` 控制，不需要复制或修改 Compose 文件。

## 前置条件

- Docker 26+
- Docker Compose 2.25+
- 可访问的 OpenAI-compatible 模型
- 用于登录验证码的 SMTP 或 Resend 账号
- 使用支付功能时所需的 Stripe 账号

## 快速开始

```bash
cp deploy/.env.example deploy/.env
```

编辑 `deploy/.env`，至少替换：

```dotenv
AUTH_SECRET_KEY=replace-with-a-long-random-secret
POSTGRES_PASSWORD=replace-with-a-database-password
REDIS_PASSWORD=replace-with-a-redis-password

AGENT_API_KEY=sk-...
AGENT_BASE_URL=https://api.openai.com/v1/chat/completions
AGENT_MODEL_NAME=gpt-4.1-mini

MAIL_SEND_METHOD=SMTP
MAIL_USERNAME=no-reply@example.com
MAIL_PASSWORD=replace-with-a-mail-password
MAIL_FROM=no-reply@example.com
MAIL_SERVER=smtp.example.com

STRIPE_PUBLIC_KEY=pk_...
STRIPE_PRIVATE_KEY=sk_...
STRIPE_WEBHOOK_SECRET=whsec_...
```

构建并启动：

```bash
make build-all
make start
```

默认入口：

- Web 与管理后台：<http://localhost:8081>
- OpenAPI：<http://localhost:8081/api/v1/docs>

## 常用命令

```bash
make build-api     # 构建 API 镜像
make build-web     # 构建 Web 镜像
make build-all     # 构建全部镜像
make push-all      # 推送全部镜像
make start         # 启动服务
make stop          # 停止并移除容器
make logs          # 持续查看日志
make restart       # 重启并查看日志
make rebuild       # 停止、重建、启动并查看日志
make deploy        # 构建并重启
make deploy-ci     # 执行迁移、健康检查和无交互部署
```

所有部署目标统一定义在仓库根目录的 `Makefile` 中，以上命令必须从仓库根目录运行。

## GitHub Actions 自动部署

`.github/workflows/deploy.yml` 会在 GitHub 仓库 `main` 分支中的 API、Web、部署配置或工作流发生变化时，通过 SSH 登录服务器，拉取最新代码并执行 `make deploy-ci`。也可以在 Actions 页面手动触发。

先在服务器上完成一次初始化：

1. 克隆仓库并切换到 `main` 分支。
2. 在 `deploy/.env` 中配置生产环境变量。
3. 确认部署用户可以执行 `git pull --ff-only`、Docker 和 Docker Compose。
4. 手动运行一次 `make deploy-ci`，确认数据库迁移和健康检查均能通过。

然后在 GitHub 仓库的 `Settings > Secrets and variables > Actions` 中添加：

- `EC2_HOST`：服务器地址。
- `EC2_PORT`：SSH 端口，通常为 `22`。
- `EC2_USER`：部署用户。
- `EC2_SSH_KEY`：部署用户对应的 SSH 私钥。
- `EC2_KNOWN_HOSTS`：服务器的 SSH host key；应从可信渠道获取并核对指纹。
- `DEPLOY_PATH`：服务器上的仓库绝对路径，例如 `/opt/remove-ai-flavor`。

自动部署会在服务器本地构建镜像，依次启动 PostgreSQL 和 Redis、执行 Alembic 迁移、启动全部服务并等待健康检查。任一步骤失败时，Action 会失败并输出必要的容器诊断信息。

## 服务与端口

- `nginx`：默认暴露 `8081`，统一代理 Web 和 `/api/`。
- `web`：容器内监听 `3000`，不直接暴露主机端口。
- `api`：容器内监听 `8000`，健康检查访问 `/health`。
- `postgres`：主机默认暴露 `15432`，容器内为 `5432`。
- `redis`：主机默认暴露 `16379`，容器内为 `6379`。
- `stripe-cli`：把 Stripe webhook 转发到 `/api/v1/orders/stripe/webhook`。

如果不使用支付，可在本地 Compose 副本中停用 `stripe-cli`；API 其他功能仍可运行。

## 环境切换

生产模板：

```bash
cp deploy/.env.example deploy/.env
```

测试模板：

```bash
cp deploy/.env.test.example deploy/.env
```

同一主机运行多个环境时，每个环境必须设置不同的值：

```dotenv
IMAGE_SUFFIX=-test
CONTAINER_SUFFIX=-test
NETWORK_NAME=remove-ai-flavor-network-test
NGINX_PORT=8082
POSTGRES_EXPOSE_PORT=15433
REDIS_EXPOSE_PORT=16380
```

Compose 项目名由 `CONTAINER_PREFIX` 和 `CONTAINER_SUFFIX` 组合生成。避免多个环境复用同一个 `volumes/` 目录。

## 数据库迁移

首次部署和每次包含迁移的升级都应执行：

```bash
docker compose --project-directory deploy -f deploy/docker-compose.yaml exec api alembic upgrade head
```

查看当前版本：

```bash
docker compose --project-directory deploy -f deploy/docker-compose.yaml exec api alembic current
```

不要依赖应用启动时的 `create_all` 替代 Alembic；它不会安全地修改现有列或约束。

## 日志与健康检查

```bash
docker compose --project-directory deploy -f deploy/docker-compose.yaml ps
docker compose --project-directory deploy -f deploy/docker-compose.yaml logs -f api
docker compose --project-directory deploy -f deploy/docker-compose.yaml logs -f web
docker compose --project-directory deploy -f deploy/docker-compose.yaml logs -f nginx
docker compose --project-directory deploy -f deploy/docker-compose.yaml exec api wget -qO- http://127.0.0.1:8000/health
```

出现模型调用错误时，依次检查 `AGENT_API_KEY`、`AGENT_BASE_URL`、`AGENT_MODEL_NAME` 和上游网络。API 日志会隐藏密钥，但生产日志仍不应发送到不受信任的平台。

## 数据持久化与备份

默认数据目录：

```text
deploy/volumes/
├── db/data/
└── redis/data/
```

备份 PostgreSQL：

```bash
docker compose --project-directory deploy -f deploy/docker-compose.yaml exec -T postgres \
  pg_dump -U "$POSTGRES_USER" "$POSTGRES_DB" > backup.sql
```

恢复前应停止写入并先验证备份。Redis 中包含短期验证码、缓存和访客额度，通常不替代 PostgreSQL 备份。

## 生产安全清单

- 更换 `.env.example` 中的所有示例密钥和密码。
- 设置 `AUTH_IS_DEBUG=False`、`API_RELOAD=False`。
- 使用 HTTPS，并在可信反向代理层终止 TLS。
- 不向公网暴露 PostgreSQL 和 Redis；如无运维需要，删除对应 `ports`。
- 限制 `.env` 和 `volumes/` 的文件权限，并确保它们不进入 Git。
- 定期轮换 API Key、邮件凭据、Stripe 密钥和 JWT 密钥。
- 为数据库建立自动备份和恢复演练。
- 升级前执行数据库备份，并先在测试环境运行迁移。
