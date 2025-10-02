from datetime import datetime
from typing import Any, Dict, List, Optional

from pydantic import BaseModel, Field, validator

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


# Dify 相关的 Schema 定义


class DifyFileSchema(BaseModel):
    """Dify 文件配置 Schema"""

    type: str = Field(default="image", description="文件类型，如 image, document 等")
    transfer_method: str = Field(default="remote_url", description="传输方式，如 remote_url, local_file 等")
    url: str = Field(..., description="文件 URL 地址")

    @validator("type")
    def validate_file_type(cls, v):
        """验证文件类型"""
        allowed_types = ["image", "document", "audio", "video", "text"]
        if v not in allowed_types:
            raise ValueError(f'文件类型必须是: {", ".join(allowed_types)}')
        return v

    @validator("transfer_method")
    def validate_transfer_method(cls, v):
        """验证传输方式"""
        allowed_methods = ["remote_url", "local_file"]
        if v not in allowed_methods:
            raise ValueError(f'传输方式必须是: {", ".join(allowed_methods)}')
        return v


class DifyModelConfSchema(BaseModel):
    """Dify 模型配置 Schema"""

    files: Optional[List[DifyFileSchema]] = Field(default=None, description="文件列表")
    inputs: Optional[Dict[str, Any]] = Field(default=None, description="输入参数")
    user_prefix: Optional[str] = Field(default=None, description="用户ID前缀")

    class Config:
        json_schema_extra = {
            "example": {
                "files": [
                    {
                        "type": "image",
                        "transfer_method": "remote_url",
                        "url": "https://example.com/image.png",
                    }
                ],
                "inputs": {"context": "这是一个示例上下文"},
                "user_prefix": "user",
            }
        }


class AgentCreateDify(BaseModel):
    """创建 Dify Agent 的专用 Schema"""

    name: str = Field(..., min_length=1, max_length=100, description="Agent 名称")
    api_url: str = Field(..., description="Dify API URL，如 https://api.dify.ai/v1/chat-messages")
    api_key: str = Field(..., min_length=1, description="Dify API Key")
    model_conf: Optional[DifyModelConfSchema] = Field(default=None, description="Dify 模型配置")
    is_think: bool = Field(default=False, description="是否显示思考过程")
    is_stream: bool = Field(default=True, description="是否使用流式响应")

    @validator("api_url")
    def validate_dify_api_url(cls, v):
        """验证 Dify API URL"""
        if not v.startswith(("http://", "https://")):
            raise ValueError("API URL 必须以 http:// 或 https:// 开头")
        if "dify" not in v.lower():
            raise ValueError("请确认这是一个有效的 Dify API URL")
        return v


class AgentUpdateDify(BaseModel):
    """更新 Dify Agent 的专用 Schema"""

    name: Optional[str] = Field(None, min_length=1, max_length=100, description="Agent 名称")
    api_url: Optional[str] = Field(None, description="Dify API URL")
    api_key: Optional[str] = Field(None, min_length=1, description="Dify API Key")
    model_conf: Optional[DifyModelConfSchema] = Field(None, description="Dify 模型配置")
    is_think: Optional[bool] = Field(None, description="是否显示思考过程")
    is_stream: Optional[bool] = Field(None, description="是否使用流式响应")

    @validator("api_url")
    def validate_dify_api_url(cls, v):
        """验证 Dify API URL"""
        if v is not None:
            if not v.startswith(("http://", "https://")):
                raise ValueError("API URL 必须以 http:// 或 https:// 开头")
            if "dify" not in v.lower():
                raise ValueError("请确认这是一个有效的 Dify API URL")
        return v


class DifyTestResponse(BaseModel):
    """Dify 测试响应 Schema"""

    success: bool = Field(description="测试是否成功")
    message: str = Field(description="响应消息")
    response_time: float = Field(description="响应时间（毫秒）")
    details: Optional[Dict[str, Any]] = Field(default=None, description="详细信息")

    class Config:
        json_schema_extra = {
            "example": {
                "success": True,
                "message": "Dify Agent 连接正常",
                "response_time": 1250.5,
                "details": {
                    "response_content": "Hello! How can I help you today?",
                    "conversation_id": "conv_123456",
                    "message_id": "msg_789012",
                },
            }
        }
