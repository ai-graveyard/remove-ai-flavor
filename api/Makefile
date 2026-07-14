# Remove AI Flavor API - Makefile
# 
# 常用开发命令的快捷方式

.PHONY: help install dev clean-imports check-imports format lint test db-migrate db-upgrade db-history clean-file check-file

# 默认目标
help:
	@echo "Remove AI Flavor API - 开发工具"
	@echo ""
	@echo "可用命令:"
	@echo "  install        安装依赖"
	@echo "  dev           启动开发服务器"
	@echo "  clean-imports  清理未使用的 import"
	@echo "  check-imports  检查代码格式（不修改）"
	@echo "  format        格式化代码"
	@echo "  lint          代码检查"
	@echo "  test          运行测试"
	@echo "  db-migrate    创建数据库迁移"
	@echo "  db-upgrade    执行数据库迁移"
	@echo ""

# 安装依赖
install:
	@echo "📦 安装依赖..."
	uv sync

# 启动开发服务器
dev:
	@echo "🚀 启动开发服务器..."
	uv run python -m app.main

# 清理未使用的 import（修复模式）
clean-imports:
	@echo "🧹 清理未使用的 import..."
	./scripts/clean_imports.sh

# 检查代码格式（检查模式）
check-imports:
	@echo "🔍 检查代码格式..."
	./scripts/clean_imports.sh check

# 格式化代码（仅格式化，不清理 import）
format:
	@echo "✨ 格式化代码..."
	uv run black --line-length 128 app tests
	uv run isort --profile black --line-length 128 app tests

# 代码检查
lint:
	@echo "🔍 代码检查..."
	uv run black --line-length 128 --check app tests
	uv run isort --profile black --line-length 128 --check-only app tests
	uv run autoflake --remove-all-unused-imports --remove-unused-variables --ignore-init-module-imports --check --recursive app tests

# 运行后端测试
test:
	@echo "🧪 运行测试..."
	uv run pytest

# 创建数据库迁移
db-migrate:
	@echo "📊 创建数据库迁移..."
	@read -p "请输入迁移描述: " desc; \
	uv run alembic revision --autogenerate -m "$$desc"

# 执行数据库迁移
db-upgrade:
	@echo "📊 执行数据库迁移..."
	uv run alembic upgrade head

# 查看数据库迁移历史
db-history:
	@echo "📊 数据库迁移历史..."
	uv run alembic history

# 清理指定文件
clean-file:
	@read -p "请输入文件路径: " file; \
	./scripts/clean_imports.sh "$$file"

# 检查指定文件
check-file:
	@read -p "请输入文件路径: " file; \
	./scripts/clean_imports.sh check "$$file"
