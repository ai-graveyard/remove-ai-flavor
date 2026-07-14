"""停用旧 Dify Agent 配置。

Revision ID: a9f3c2d1e4b5
Revises: 44ed2273699a
Create Date: 2026-07-14
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

# Alembic 迁移依赖标识。
revision: str = "a9f3c2d1e4b5"
down_revision: Union[str, None] = "44ed2273699a"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """
    将旧 Dify Agent 标记为 custom 并软删除。

    Dify Chat Messages URL 不兼容 OpenAI Chat Completions，不能自动启用。
    保留 URL、密钥和模型配置，便于管理员审计和手工迁移。
    """
    if not sa.inspect(op.get_bind()).has_table("agent"):
        # 全新数据库没有历史 Agent，无需执行数据迁移。
        return

    op.execute(
        """
        UPDATE agent
        SET source = 'CUSTOM',
            is_deleted = TRUE,
            deleted_at = COALESCE(deleted_at, CURRENT_TIMESTAMP)
        WHERE source = 'DIFY'
        """
    )


def downgrade() -> None:
    """
    数据降级保持不变。

    迁移后无法可靠区分原 Dify 行和原 custom 行，自动恢复会误改业务数据。
    """
