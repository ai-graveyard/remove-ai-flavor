from datetime import datetime
from enum import Enum
from typing import Any, Dict, Optional

from sqlmodel import JSON, Field, SQLModel

from app.schemas.membership import MembershipType


class AgentSource(str, Enum):
    """Agent source type"""

    LLM = "llm"
    DIFY = "dify"
    FASTGPT = "fastgpt"
    COZE = "coze"
    CUSTOM = "custom"


class Agent(SQLModel, table=True):
    """Agent model"""

    id: Optional[int] = Field(default=None, primary_key=True)

    # 基础信息
    name: str = Field(index=True, description="AI助手名称")
    source: AgentSource = Field(default=AgentSource.LLM, description="AI助手来源类型")
    api_url: str = Field(description="API接口地址")
    api_key: str = Field(description="API密钥")
    model_conf: Optional[Dict[str, Any]] = Field(default=None, sa_type=JSON, description="模型配置参数JSON")
    is_think: bool = Field(default=False, description="是否显示思考过程")
    is_stream: bool = Field(default=True, description="是否使用流式响应")
    
    # 会员权限
    required_membership_type: MembershipType = Field(
        default=MembershipType.FREE,
        description="使用此 Agent 所需的最低会员等级",
        index=True
    )

    # 时间戳
    is_deleted: bool = Field(default=False, description="软删除标记")
    created_at: datetime = Field(default_factory=datetime.utcnow, description="创建时间")
    updated_at: datetime = Field(default_factory=datetime.utcnow, description="更新时间")
    deleted_at: Optional[datetime] = Field(default=None, description="软删除时间戳")
