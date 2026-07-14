from datetime import datetime
from typing import Any, Dict, List, Optional

from pydantic import BaseModel, Field

from app.models.agent import AgentSource
from app.schemas.membership import MembershipType


class AgentBase(BaseModel):
    """Agent base schema"""

    name: str = Field(..., min_length=1, max_length=100, description="Agent name")
    source: AgentSource = Field(default=AgentSource.LLM, description="Agent source")
    api_url: str = Field(..., description="API URL")
    api_key: str = Field(..., min_length=1, description="API key")
    model_conf: Optional[Dict[str, Any]] = Field(default=None, description="Model configuration JSON")
    is_think: bool = Field(default=False, description="Whether to show thinking process")
    is_stream: bool = Field(default=True, description="Whether to use streaming response")
    required_membership_type: MembershipType = Field(
        default=MembershipType.FREE,
        description="Required membership type to use this agent"
    )


class AgentCreate(AgentBase):
    """Agent creation schema"""


class AgentUpdate(BaseModel):
    """Agent update schema"""

    name: Optional[str] = Field(None, min_length=1, max_length=100)
    source: Optional[AgentSource] = None
    api_url: Optional[str] = None
    api_key: Optional[str] = Field(None, min_length=1)
    model_conf: Optional[Dict[str, Any]] = None
    is_think: Optional[bool] = None
    is_stream: Optional[bool] = None
    required_membership_type: Optional[MembershipType] = None


class Agent(AgentBase):
    """Agent response schema"""

    id: int
    is_deleted: bool
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class AgentPublic(BaseModel):
    """
    普通用户可见的 Agent 响应模型。

    与管理端详情模型相比，此模型明确排除上游 API Key，防止聊天和 Agent
    选择接口把服务端凭据发送到浏览器。
    """

    id: int
    name: str
    source: AgentSource
    api_url: str
    model_conf: Optional[Dict[str, Any]]
    is_think: bool
    is_stream: bool
    required_membership_type: MembershipType
    is_deleted: bool
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class AgentList(BaseModel):
    """Agent list schema for admin"""

    id: int
    name: str
    source: AgentSource
    api_url: str
    model_conf: Optional[Dict[str, Any]]
    is_think: bool
    is_stream: bool
    required_membership_type: MembershipType
    is_deleted: bool
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class AgentListResponse(BaseModel):
    """Agent list response with pagination"""

    agents: List[AgentList]
    total: int
    limit: int
    offset: int
    has_next: bool
    has_prev: bool
    total_pages: int
    current_page: int


class AgentSearchParams(BaseModel):
    """Agent search parameters"""

    name: Optional[str] = None
    source: Optional[AgentSource] = None
    is_deleted: Optional[bool] = None
    limit: int = Field(default=10, ge=1, le=100)
    offset: int = Field(default=0, ge=0)
    sort_by: Optional[str] = Field(default="id")
    sort_order: Optional[str] = Field(default="asc")


class AgentActionRequest(BaseModel):
    """Agent action request schema"""

    action: str = Field(..., description="Action to perform: delete, restore")
    lang: str = Field(default="zh", description="Language for response messages")
