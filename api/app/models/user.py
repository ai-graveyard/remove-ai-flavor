from datetime import datetime
from enum import Enum
from typing import Optional

from sqlmodel import Field, SQLModel


class UserType(str, Enum):
    """User type"""

    USER = "user"  # Regular user
    ADMIN = "admin"  # Admin


class User(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)

    # 基础信息
    username: str = Field(index=True, unique=True, description="用户名，唯一标识符")
    email: str = Field(index=True, unique=True, description="用户邮箱地址，用于登录和通知")
    password_hash: Optional[str] = Field(default=None, description="用户密码的哈希值")
    user_type: UserType = Field(default=UserType.USER, description="用户类型，区分普通用户和管理员")

    # 时间戳
    last_login_at: Optional[datetime] = Field(default=None, description="最后登录时间")
    created_at: datetime = Field(default_factory=datetime.utcnow, description="账户创建时间")
    updated_at: datetime = Field(default_factory=datetime.utcnow, description="最后更新时间")
    is_deleted: bool = Field(default=False, description="软删除标记，True表示已删除")
    deleted_at: Optional[datetime] = Field(default=None, description="软删除时间戳")
