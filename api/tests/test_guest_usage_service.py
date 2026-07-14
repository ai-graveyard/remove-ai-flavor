import pytest

from app.services.guest_usage_service import (
    GUEST_USAGE_TTL_SECONDS,
    GuestUsageLimitExceeded,
    GuestUsageService,
)


class FakeRedis:
    """
    提供访客额度测试所需最小 Redis 行为的内存替身。
    """

    def __init__(self) -> None:
        self.values: dict[str, dict[str, int]] = {}
        self.expirations: dict[str, int] = {}

    def eval(self, script: str, key_count: int, key: str, *args: int) -> int:
        """模拟额度服务使用的预占、提交和归还 Lua 脚本。"""
        assert key_count == 1
        state = self.values.setdefault(key, {"committed": 0, "pending": 0})

        if len(args) == 2:
            limit, ttl_seconds = args
            if state["committed"] + state["pending"] >= limit:
                return -1
            state["pending"] += 1
            if state["committed"] + state["pending"] == 1:
                self.expirations[key] = ttl_seconds
            return state["pending"]

        if "'committed', 1" in script and state["pending"] > 0:
            state["pending"] -= 1
            state["committed"] += 1
            return state["committed"]

        if state["pending"] > 0:
            state["pending"] -= 1
        return state["committed"]


def test_reserve_allows_three_uses_and_rejects_fourth() -> None:
    """访客只能成功预占前三次额度。"""
    service = GuestUsageService(FakeRedis())

    service.reserve("guest-1")
    service.reserve("guest-1")
    service.reserve("guest-1")

    with pytest.raises(GuestUsageLimitExceeded):
        service.reserve("guest-1")


def test_release_returns_reserved_slot_after_failure() -> None:
    """优化失败归还额度后，访客仍可再次使用该次数。"""
    service = GuestUsageService(FakeRedis())
    service.reserve("guest-1")
    service.reserve("guest-1")
    service.reserve("guest-1")

    service.release("guest-1")

    service.reserve("guest-1")


def test_commit_returns_only_successful_usage_count() -> None:
    """并发预占后，提交返回成功次数而不是执行中请求数。"""
    redis_client = FakeRedis()
    service = GuestUsageService(redis_client)
    service.reserve("guest-1")
    service.reserve("guest-1")
    service.reserve("guest-1")

    assert service.commit("guest-1") == 1

    service.release("guest-1")
    service.release("guest-1")
    assert redis_client.values["guest-optimize:guest-1"] == {
        "committed": 1,
        "pending": 0,
    }


def test_first_reservation_sets_key_expiration() -> None:
    """首次预占为访客计数设置过期时间，避免 Redis 键无限增长。"""
    redis_client = FakeRedis()
    service = GuestUsageService(redis_client)

    service.reserve("guest-1")

    assert redis_client.expirations["guest-optimize:guest-1"] == GUEST_USAGE_TTL_SECONDS
