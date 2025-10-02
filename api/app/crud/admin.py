from datetime import datetime, timedelta
from typing import List, Optional

from sqlmodel import Session, and_, func, select

from app.core.i18n import get_message
from app.core.logging import get_logger
from app.core.security import hash_password
from app.crud.order import OrderCRUD
from app.models.chat import Chat
from app.models.membership import MembershipPlan, UserMembership
from app.models.message import Message
from app.models.user import User, UserType
from app.schemas.admin import (
    AdminChatList,
    AdminDashboard,
    AdminUserList,
    ChatSearchParams,
    UserActionRequest,
    UserCreateRequest,
    UserListResponse,
    UserSearchParams,
    UserUpdateRequest,
)
from app.services.membership_service import MembershipService

logger = get_logger(__name__)


async def get_dashboard_stats(session: Session) -> AdminDashboard:
    """获取管理员仪表板统计数据"""
    today = datetime.utcnow().date()
    now = datetime.utcnow()

    # User statistics
    total_users = session.exec(select(func.count(User.id))).first() or 0
    active_users = session.exec(select(func.count(User.id)).where(User.is_deleted == False)).first() or 0
    admin_users = (
        session.exec(
            select(func.count(User.id)).where(and_(User.user_type == UserType.ADMIN, User.is_deleted == False))
        ).first()
        or 0
    )
    deleted_users = session.exec(select(func.count(User.id)).where(User.is_deleted == True)).first() or 0

    # Today's new users
    today_new_users = session.exec(select(func.count(User.id)).where(func.date(User.created_at) == today)).first() or 0

    # 会员类型统计
    # 获取有活跃会员的用户统计
    membership_stats = session.exec(
        select(MembershipPlan.type, func.count(func.distinct(UserMembership.user_id)).label("count"))
        .select_from(UserMembership)
        .join(MembershipPlan, UserMembership.membership_plan_id == MembershipPlan.id)
        .join(User, UserMembership.user_id == User.id)
        .where(
            UserMembership.is_active == True,
            UserMembership.start_date <= now,
            UserMembership.end_date > now,
            UserMembership.is_deleted == False,
            User.is_deleted == False,
        )
        .group_by(MembershipPlan.type)
    ).all()
    
    # 初始化会员统计
    monthly_users = 0
    yearly_users = 0
    
    # 处理会员统计结果
    for row in membership_stats:
        if row.type == "monthly":
            monthly_users = row.count
        elif row.type == "yearly":
            yearly_users = row.count
    
    # 免费用户 = 总活跃用户 - 月度会员 - 年度会员
    free_users = active_users - monthly_users - yearly_users

    # Chat statistics
    total_chats = session.exec(select(func.count(Chat.id))).first() or 0
    active_chats = session.exec(select(func.count(Chat.id)).where(Chat.is_deleted == False)).first() or 0

    # Today's new chats
    today_new_chats = session.exec(select(func.count(Chat.id)).where(func.date(Chat.created_at) == today)).first() or 0

    # 7日对话数统计
    seven_days_ago = now - timedelta(days=7)
    seven_days_chats = session.exec(
        select(func.count(Chat.id)).where(Chat.created_at >= seven_days_ago)
    ).first() or 0

    # 本月对话数统计
    month_start = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)
    monthly_chats = session.exec(
        select(func.count(Chat.id)).where(Chat.created_at >= month_start)
    ).first() or 0

    # Message statistics
    total_messages = session.exec(select(func.count(Message.id))).first() or 0

    # 获取订单统计数据
    order_stats = await OrderCRUD.get_order_stats(session)

    return AdminDashboard(
        # 用户统计
        total_users=total_users,
        active_users=active_users,
        admin_users=admin_users,
        deleted_users=deleted_users,
        today_new_users=today_new_users,
        
        # 会员类型统计
        free_users=free_users,
        monthly_users=monthly_users,
        yearly_users=yearly_users,
        
        # 对话统计
        total_chats=total_chats,
        active_chats=active_chats,
        total_messages=total_messages,
        today_new_chats=today_new_chats,
        monthly_chats=monthly_chats,
        seven_days_chats=seven_days_chats,
        
        # 订单数量统计
        total_orders=order_stats["total_orders"],
        today_orders=order_stats["today_orders"],
        seven_days_orders=order_stats["seven_days_orders"],
        monthly_orders=order_stats["monthly_orders"],
        
        # 收入统计
        today_revenue=order_stats["daily_revenue"],
        seven_days_revenue=order_stats["seven_days_revenue"],
        monthly_revenue=order_stats["monthly_revenue"],
        total_revenue=order_stats["total_revenue"],
    )

def get_users_with_pagination(session: Session, params: UserSearchParams) -> UserListResponse:
    """获取带分页信息的用户列表"""
    # 构建基础查询
    base_query = select(User).outerjoin(Chat, User.id == Chat.user_id)

    # 应用筛选条件
    filters = []
    if params.email:
        filters.append(User.email.contains(params.email))
    if params.username:
        filters.append(User.username.contains(params.username))
    if params.user_type is not None:
        filters.append(User.user_type == params.user_type)
    if params.is_deleted is not None:
        filters.append(User.is_deleted == params.is_deleted)

    if filters:
        base_query = base_query.where(and_(*filters))

    # 获取总数 - 注意需要根据用户ID去重
    count_query = select(func.count(func.distinct(User.id)))
    if filters:
        count_query = count_query.select_from(User).where(and_(*filters))
    else:
        count_query = count_query.select_from(User)

    total = session.exec(count_query).first() or 0

    # 获取用户列表和统计信息，包括会员信息
    query = (
        select(
            User.id,
            User.username,
            User.email,
            User.user_type,
            User.is_deleted,
            User.created_at,
            User.last_login_at,
            func.count(Chat.id).label("chat_count"),
            func.max(Chat.updated_at).label("last_active"),
            MembershipPlan.type.label("membership_type"),
        )
        .outerjoin(Chat, User.id == Chat.user_id)
        .outerjoin(
            UserMembership,
            and_(
                User.id == UserMembership.user_id,
                UserMembership.is_active == True,
                UserMembership.is_deleted == False,
                UserMembership.end_date > datetime.utcnow(),
            ),
        )
        .outerjoin(MembershipPlan, UserMembership.membership_plan_id == MembershipPlan.id)
    )

    # 应用筛选条件
    if filters:
        query = query.where(and_(*filters))

    # 会员类型过滤
    if params.membership_type is not None:
        if params.membership_type == "free":
            # 免费会员：没有有效会员记录或会员类型为free
            query = query.where((MembershipPlan.type == "free") | (MembershipPlan.type.is_(None)))
        else:
            query = query.where(MembershipPlan.type == params.membership_type)

    # GROUP BY 和排序
    query = query.group_by(User.id, MembershipPlan.type)

    # 应用排序
    if hasattr(User, params.sort_by):
        sort_column = getattr(User, params.sort_by)
    elif params.sort_by == "membership_type":
        sort_column = MembershipPlan.type
    else:
        sort_column = User.id

    if params.sort_order == "desc":
        query = query.order_by(sort_column.desc())
    else:
        query = query.order_by(sort_column.asc())

    query = query.offset(params.offset).limit(params.limit)

    results = session.exec(query).all()

    users = [
        AdminUserList(
            id=row.id,
            username=row.username,
            email=row.email,
            user_type=row.user_type,
            membership_type=row.membership_type or "free",  # 默认为免费会员
            is_deleted=row.is_deleted,
            created_at=row.created_at,
            last_login_at=row.last_login_at,
            chat_count=row.chat_count or 0,
            last_active=row.last_active,
        )
        for row in results
    ]

    # 计算分页信息
    total_pages = (total + params.limit - 1) // params.limit if params.limit > 0 else 1
    current_page = (params.offset // params.limit) + 1 if params.limit > 0 else 1
    has_next = params.offset + params.limit < total
    has_prev = params.offset > 0

    return UserListResponse(
        users=users,
        total=total,
        limit=params.limit,
        offset=params.offset,
        has_next=has_next,
        has_prev=has_prev,
        total_pages=total_pages,
        current_page=current_page,
    )


def get_chats_with_user_info(session: Session, params: ChatSearchParams):
    """获取对话列表和用户信息（带分页）"""
    # 构建基础查询
    base_query = (
        select(
            Chat.id,
            Chat.user_id,
            Chat.title,
            Chat.created_at,
            Chat.updated_at,
            User.email.label("user_email"),
            User.username.label("username"),
            func.count(Message.id).label("message_count"),
        )
        .join(User, Chat.user_id == User.id)
        .outerjoin(Message, Chat.id == Message.chat_id)
        .group_by(Chat.id, User.email, User.username)
    )

    # 应用筛选条件
    if params.user_id:
        base_query = base_query.where(Chat.user_id == params.user_id)
    if params.user_email:
        base_query = base_query.where(User.email.contains(params.user_email))
    if params.username:
        base_query = base_query.where(User.username.contains(params.username))
    if params.title:
        base_query = base_query.where(Chat.title.contains(params.title))

    base_query = base_query.where(Chat.is_deleted == False)

    # 获取总数
    count_query = select(func.count()).select_from(base_query.order_by(None).subquery())
    total = session.exec(count_query).one()

    # 应用排序
    sort_column = Chat.updated_at  # 默认排序字段
    if params.sort_by:
        if params.sort_by == "id":
            sort_column = Chat.id
        elif params.sort_by == "title":
            sort_column = Chat.title
        elif params.sort_by == "created_at":
            sort_column = Chat.created_at
        elif params.sort_by == "updated_at":
            sort_column = Chat.updated_at
        elif params.sort_by == "user_email":
            sort_column = User.email
        elif params.sort_by == "username":
            sort_column = User.username
        elif params.sort_by == "message_count":
            sort_column = func.count(Message.id)

    # 获取分页数据
    if params.sort_order == "desc":
        query = base_query.order_by(sort_column.desc())
    else:
        query = base_query.order_by(sort_column.asc())

    query = query.offset(params.offset).limit(params.limit)
    results = session.exec(query).all()

    chats = [
        AdminChatList(
            id=row.id,
            user_id=row.user_id,
            user_email=row.user_email,
            username=row.username,
            title=row.title,
            message_count=row.message_count or 0,
            created_at=row.created_at,
            updated_at=row.updated_at,
        )
        for row in results
    ]

    # 计算分页信息
    total_pages = (total + params.limit - 1) // params.limit if params.limit > 0 else 1
    current_page = (params.offset // params.limit) + 1 if params.limit > 0 else 1
    has_next = params.offset + params.limit < total
    has_prev = params.offset > 0

    return {
        "chats": chats,
        "total": total,
        "limit": params.limit,
        "offset": params.offset,
        "has_next": has_next,
        "has_prev": has_prev,
        "total_pages": total_pages,
        "current_page": current_page,
    }


def update_user(session: Session, user_id: int, update_data: UserUpdateRequest) -> Optional[User]:
    """更新用户信息"""
    user = session.get(User, user_id)
    if not user:
        return None

    if update_data.user_type is not None:
        user.user_type = update_data.user_type

    # 会员类型更新通过会员服务处理
    if update_data.membership_type is not None:
        membership_service = MembershipService(session)
        success = membership_service.update_user_membership(user.id, update_data.membership_type)
        if not success:

            logger.warning(f"更新用户 {user.id} 的会员类型为 {update_data.membership_type} 失败")

    if update_data.is_deleted is not None:
        user.is_deleted = update_data.is_deleted
    if update_data.username is not None:
        user.username = update_data.username

    user.updated_at = datetime.utcnow()
    session.add(user)
    session.commit()
    session.refresh(user)

    return user


def get_user_detail(session: Session, user_id: int) -> Optional[User]:
    """获取用户详细信息"""
    return session.get(User, user_id)


def get_chat_messages(session: Session, chat_id: int) -> List[Message]:
    """获取对话的所有消息"""
    return session.exec(select(Message).where(Message.chat_id == chat_id).order_by(Message.created_at)).all()


def create_user_by_admin(session: Session, user_data: UserCreateRequest) -> User:
    """管理员创建新用户"""
    # 检查邮箱是否已存在
    existing_user = session.exec(select(User).where(User.email == user_data.email)).first()

    if existing_user:
        raise ValueError(f"{get_message('email_already_exists')}: {user_data.email}")

    # 检查用户名是否已存在（如果提供了用户名）
    if user_data.username:
        existing_username = session.exec(select(User).where(User.username == user_data.username)).first()

        if existing_username:
            raise ValueError(f"{get_message('username_already_exists')}: {user_data.username}")

    # 创建新用户
    new_user = User(
        email=user_data.email,
        username=user_data.username,
        password_hash=hash_password(user_data.password),  # 对密码进行哈希处理
        user_type=user_data.user_type,
        is_deleted=False,
        last_login_at=None,  # 管理员创建的用户初始没有登录时间
    )

    session.add(new_user)
    session.commit()
    session.refresh(new_user)

    # 设置用户会员类型
    if user_data.membership_type:
        membership_service = MembershipService(session)
        success = membership_service.update_user_membership(new_user.id, user_data.membership_type)
        if not success:
            from app.core.logging import get_logger

            logger = get_logger(__name__)
            logger.warning(f"为用户 {new_user.id} 设置会员类型 {user_data.membership_type} 失败")

    return new_user


def delete_or_restore_user(session: Session, user_id: int, action_data: UserActionRequest) -> User:
    """删除或恢复用户"""
    user = session.get(User, user_id)
    if not user:
        raise ValueError(get_message("user_not_found"))

    if action_data.action == "delete":
        if user.is_deleted:
            raise ValueError(get_message("user_already_deleted"))
        user.is_deleted = True
        user.deleted_at = datetime.utcnow()  # 设置删除时间戳
    elif action_data.action == "restore":
        if not user.is_deleted:
            raise ValueError(get_message("user_not_deleted"))
        user.is_deleted = False
        user.deleted_at = None  # 恢复时清空删除时间戳
    else:
        raise ValueError(get_message("invalid_operation_type"))

    user.updated_at = datetime.utcnow()
    session.add(user)
    session.commit()
    session.refresh(user)

    return user


def check_user_can_be_deleted(session: Session, user_id: int) -> dict:
    """检查用户是否可以安全删除"""
    user = session.get(User, user_id)
    if not user:
        raise ValueError(get_message("user_not_found"))

    # 统计用户的对话数量
    chat_count = (
        session.exec(select(func.count(Chat.id)).where(and_(Chat.user_id == user_id, Chat.is_deleted == False))).first() or 0
    )

    # 统计用户的消息数量
    message_count = (
        session.exec(
            select(func.count(Message.id)).where(Message.chat_id.in_(select(Chat.id).where(Chat.user_id == user_id)))
        ).first()
        or 0
    )

    return {
        "can_delete": True,  # 总是可以删除（软删除）
        "chat_count": chat_count,
        "message_count": message_count,
        "user_type": user.user_type,
        "warning": ("删除用户将保留其数据，但用户无法登录" if chat_count > 0 or message_count > 0 else None),
    }
