from datetime import datetime
from typing import List, Optional

from sqlmodel import Session, func, select

from app.core.config import settings
from app.core.logging import get_logger
from app.models.agent import Agent, AgentSource
from app.schemas.agent import (
    AgentActionRequest,
    AgentCreate,
    AgentList,
    AgentListResponse,
    AgentSearchParams,
    AgentUpdate,
)
from app.schemas.membership import MembershipType

logger = get_logger(__name__)


def get_agents_with_pagination(session: Session, params: AgentSearchParams) -> AgentListResponse:
    """Get agents with pagination and search"""
    query = select(Agent)

    # Build where conditions
    conditions = []

    if params.name:
        conditions.append(Agent.name.ilike(f"%{params.name}%"))

    if params.source:
        conditions.append(Agent.source == params.source)

    if params.is_deleted is not None:
        conditions.append(Agent.is_deleted == params.is_deleted)

    if conditions:
        query = query.where(*conditions)

    # Add sorting
    if params.sort_by and hasattr(Agent, params.sort_by):
        sort_column = getattr(Agent, params.sort_by)
        if params.sort_order == "desc":
            query = query.order_by(sort_column.desc())
        else:
            query = query.order_by(sort_column)

    # Get total count
    count_query = select(func.count()).select_from(Agent)
    if conditions:
        count_query = count_query.where(*conditions)
    total = session.exec(count_query).one()

    # Apply pagination
    query = query.offset(params.offset).limit(params.limit)
    agents = session.exec(query).all()

    # Calculate pagination info
    total_pages = (total + params.limit - 1) // params.limit if params.limit > 0 else 1
    current_page = (params.offset // params.limit) + 1 if params.limit > 0 else 1
    has_next = params.offset + params.limit < total
    has_prev = params.offset > 0

    return AgentListResponse(
        agents=[AgentList.model_validate(agent) for agent in agents],
        total=total,
        limit=params.limit,
        offset=params.offset,
        has_next=has_next,
        has_prev=has_prev,
        total_pages=total_pages,
        current_page=current_page,
    )


def get_agent_detail(session: Session, agent_id: int) -> Optional[Agent]:
    """Get agent detail by id"""
    return session.get(Agent, agent_id)


def is_agent_accessible(agent: Agent, user_membership_type: MembershipType | str) -> bool:
    """
    判断用户会员等级是否允许使用指定 Agent。

    参数:
    - agent: 待访问的 Agent。
    - user_membership_type: 当前用户会员等级。

    返回:
    - bool: Agent 活跃且用户等级不低于 Agent 要求时返回 True。
    """
    if agent.is_deleted:
        return False

    membership_value = getattr(user_membership_type, "value", user_membership_type)
    required_value = getattr(agent.required_membership_type, "value", agent.required_membership_type)
    levels = {
        MembershipType.FREE.value: 0,
        MembershipType.MONTHLY.value: 1,
        MembershipType.YEARLY.value: 2,
    }
    return levels.get(str(membership_value), -1) >= levels.get(str(required_value), 99)


def get_accessible_agent(
    session: Session,
    agent_id: int,
    user_membership_type: MembershipType | str,
) -> Optional[Agent]:
    """
    按 ID 获取当前会员可使用的活跃 Agent。

    参数:
    - session: 数据库会话。
    - agent_id: Agent ID。
    - user_membership_type: 当前用户会员等级。

    返回:
    - Optional[Agent]: 有权限时返回 Agent，否则返回 None。
    """
    agent = get_agent_detail(session, agent_id)
    if not agent or not is_agent_accessible(agent, user_membership_type):
        return None
    return agent


def create_agent(session: Session, agent_data: AgentCreate) -> Agent:
    """Create new agent"""
    agent = Agent(**agent_data.model_dump())
    session.add(agent)
    session.commit()
    session.refresh(agent)
    return agent


def update_agent(session: Session, agent_id: int, agent_data: AgentUpdate) -> Optional[Agent]:
    """Update agent"""
    agent = session.get(Agent, agent_id)
    if not agent:
        return None

    update_data = agent_data.model_dump(exclude_unset=True)
    if update_data:
        for key, value in update_data.items():
            setattr(agent, key, value)
        agent.updated_at = datetime.utcnow()
        session.add(agent)
        session.commit()
        session.refresh(agent)

    return agent


def delete_or_restore_agent(session: Session, agent_id: int, action_data: AgentActionRequest) -> Optional[Agent]:
    """Delete or restore agent (soft delete)"""
    agent = session.get(Agent, agent_id)
    if not agent:
        return None

    if action_data.action == "delete":
        agent.is_deleted = True
        agent.deleted_at = datetime.utcnow()  # 设置删除时间戳
    elif action_data.action == "restore":
        agent.is_deleted = False
        agent.deleted_at = None  # 恢复时清空删除时间戳
    else:
        raise ValueError(f"Invalid action: {action_data.action}")

    agent.updated_at = datetime.utcnow()
    session.add(agent)
    session.commit()
    session.refresh(agent)

    return agent


def get_active_agents(session: Session, user_membership_type: Optional[str] = None) -> List[Agent]:
    """
    获取所有活跃的（未删除的）agents
    
    根据用户的会员等级过滤可用的 agent：
    - 免费会员：只能使用标记为 FREE 的 agent
    - 月度会员：可以使用 FREE 和 MONTHLY 的 agent
    - 年度会员：可以使用所有 agent（FREE、MONTHLY、YEARLY）
    
    参数:
    - session: 数据库会话
    - user_membership_type: 用户的会员类型 ('free', 'monthly', 'yearly')
    
    返回:
    - List[Agent]: 符合条件的 agent 列表
    """
    query = select(Agent).where(Agent.is_deleted == False)
    
    # 根据用户会员等级过滤 agent
    if user_membership_type:
        if user_membership_type == MembershipType.FREE:
            # 免费会员只能使用免费 agent
            query = query.where(Agent.required_membership_type == MembershipType.FREE)
        elif user_membership_type == MembershipType.MONTHLY:
            # 月度会员可以使用免费和月度 agent
            query = query.where(
                Agent.required_membership_type.in_([MembershipType.FREE, MembershipType.MONTHLY])
            )
        # 年度会员可以使用所有 agent，不需要额外过滤
    else:
        # 如果没有提供会员类型，默认只返回免费 agent
        query = query.where(Agent.required_membership_type == MembershipType.FREE)
    
    return session.exec(query).all()


def resolve_default_agent_source(source: str) -> Optional[AgentSource]:
    """
    解析默认 Agent 的展示来源。

    旧部署可能仍保留 `AGENT_SOURCE=dify`。该来源已经移除，初始化时应跳过
    默认 Agent 创建，不能把不兼容的 Dify URL 当作 OpenAI-compatible URL。

    参数:
    - source: 环境变量中的来源字符串。

    返回:
    - Optional[AgentSource]: 受支持的来源；无效或已移除时返回 None。
    """
    try:
        return AgentSource(source)
    except ValueError:
        logger.warning("跳过默认 Agent 创建：AGENT_SOURCE=%s 已不受支持", source)
        return None


def create_default_agent(session: Session) -> Optional[Agent]:
    """
    在配置有效且不存在同名活跃记录时创建默认 Agent。

    参数:
    - session: 数据库会话。

    返回:
    - Optional[Agent]: 已存在或新建的默认 Agent；配置来源无效时返回 None。
    """
    existing_agent = session.exec(select(Agent).where(Agent.name == "默认智能体", Agent.is_deleted == False)).first()

    if existing_agent:
        logger.info(f"默认智能体已存在: {existing_agent.name}")
        return existing_agent

    source = resolve_default_agent_source(settings.AGENT_SOURCE)
    if source is None:
        return None

    # 默认模型参数与后台创建的 Agent 使用同一套 Agno OpenAILike 映射规则。
    default_model_conf = {
        "model": settings.AGENT_MODEL_NAME,
        "temperature": settings.AGENT_MODEL_TEMPERATURE,
        "max_tokens": 2048,
        "top_p": 1.0,
        "frequency_penalty": 0.0,
        "presence_penalty": 0.0,
    }

    default_agent = Agent(
        name="默认智能体",
        source=source,
        api_url=settings.AGENT_BASE_URL,
        api_key=settings.AGENT_API_KEY,
        model_conf=default_model_conf,
        is_think=False,
        is_stream=True,
        is_deleted=False,
    )

    session.add(default_agent)
    session.commit()
    session.refresh(default_agent)
    logger.info(f"默认智能体创建成功: {default_agent.name}")
    return default_agent
