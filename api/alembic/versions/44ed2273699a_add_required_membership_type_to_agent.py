"""add required_membership_type to agent

Revision ID: 44ed2273699a
Revises: d936ec56f8e8
Create Date: 2025-10-02 11:13:16.061674

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
import sqlmodel



# revision identifiers, used by Alembic.
revision: str = '44ed2273699a'
down_revision: Union[str, None] = 'd936ec56f8e8'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """
    添加 Agent 会员等级字段，并兼容历史上由 create_all 创建的数据库。

    早期版本没有写入 Alembic 版本号，但 `SQLModel.metadata.create_all` 已经
    创建了目标字段和索引，因此升级必须先检查现有结构以保持幂等。
    """
    inspector = sa.inspect(op.get_bind())
    if not inspector.has_table("agent"):
        # 全新数据库由应用启动时的 SQLModel create_all 创建完整表结构。
        return

    column_names = {column["name"] for column in inspector.get_columns("agent")}
    if "required_membership_type" not in column_names:
        op.add_column(
            "agent",
            sa.Column(
                "required_membership_type",
                sa.Enum("FREE", "MONTHLY", "YEARLY", name="membershiptype"),
                nullable=True,
                server_default="FREE",
            ),
        )
        op.execute("UPDATE agent SET required_membership_type = 'FREE' WHERE required_membership_type IS NULL")
        op.alter_column("agent", "required_membership_type", nullable=False)

    index_names = {index["name"] for index in inspector.get_indexes("agent")}
    index_name = op.f("ix_agent_required_membership_type")
    if index_name not in index_names:
        op.create_index(index_name, "agent", ["required_membership_type"], unique=False)


def downgrade() -> None:
    """移除 Agent 会员等级索引和字段。"""
    op.drop_index(op.f("ix_agent_required_membership_type"), table_name="agent")
    op.drop_column("agent", "required_membership_type")
