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
    from app.schemas.membership import MembershipType
    
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


def create_default_agent(session: Session) -> Agent:
    """Create default conversation agent if not exists"""
    # Check if default agent already exists
    existing_agent = session.exec(select(Agent).where(Agent.name == "默认智能体", Agent.is_deleted == False)).first()

    if existing_agent:
        logger.info(f"默认智能体已存在: {existing_agent.name}")
    else:
        # Default model configuration
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
            source=AgentSource(settings.AGENT_SOURCE),
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
