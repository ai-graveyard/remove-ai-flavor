from types import SimpleNamespace

from app.crud.agent import is_agent_accessible
from app.schemas.membership import MembershipType


def test_free_user_cannot_access_paid_or_deleted_agent() -> None:
    """免费用户不得通过手工 Agent ID 绕过会员等级或软删除限制。"""
    paid_agent = SimpleNamespace(
        is_deleted=False,
        required_membership_type=MembershipType.MONTHLY,
    )
    deleted_agent = SimpleNamespace(
        is_deleted=True,
        required_membership_type=MembershipType.FREE,
    )

    assert is_agent_accessible(paid_agent, MembershipType.FREE) is False
    assert is_agent_accessible(deleted_agent, MembershipType.YEARLY) is False


def test_higher_membership_can_access_lower_tier_agent() -> None:
    """高等级会员应能使用同级和更低等级的活跃 Agent。"""
    monthly_agent = SimpleNamespace(
        is_deleted=False,
        required_membership_type=MembershipType.MONTHLY,
    )

    assert is_agent_accessible(monthly_agent, MembershipType.MONTHLY) is True
    assert is_agent_accessible(monthly_agent, MembershipType.YEARLY) is True
