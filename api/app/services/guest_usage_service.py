import redis

GUEST_USAGE_LIMIT = 10
GUEST_USAGE_KEY_PREFIX = "guest-optimize"
GUEST_USAGE_TTL_SECONDS = 30 * 24 * 60 * 60

RESERVE_USAGE_SCRIPT = """
local committed = tonumber(redis.call('HGET', KEYS[1], 'committed') or '0')
local pending = tonumber(redis.call('HGET', KEYS[1], 'pending') or '0')
if committed + pending >= tonumber(ARGV[1]) then
    return -1
end
pending = redis.call('HINCRBY', KEYS[1], 'pending', 1)
if committed + pending == 1 then
    redis.call('EXPIRE', KEYS[1], ARGV[2])
end
return committed + pending
"""

COMMIT_USAGE_SCRIPT = """
local pending = tonumber(redis.call('HGET', KEYS[1], 'pending') or '0')
local committed = tonumber(redis.call('HGET', KEYS[1], 'committed') or '0')
if pending <= 0 then
    return committed
end
redis.call('HINCRBY', KEYS[1], 'pending', -1)
return redis.call('HINCRBY', KEYS[1], 'committed', 1)
"""

RELEASE_USAGE_SCRIPT = """
local pending = tonumber(redis.call('HGET', KEYS[1], 'pending') or '0')
local committed = tonumber(redis.call('HGET', KEYS[1], 'committed') or '0')
if pending > 0 then
    redis.call('HINCRBY', KEYS[1], 'pending', -1)
end
return committed
"""


class GuestUsageLimitExceeded(Exception):
    """
    表示访客已经用完全部免费文本优化次数。
    """


class GuestUsageService:
    """
    使用 Redis 管理访客文本优化额度。

    额度在调用模型前原子预占，调用失败时由调用方归还，避免并发请求
    同时绕过十次限制。
    """

    def __init__(self, redis_client: redis.Redis) -> None:
        """
        初始化访客额度服务。

        参数:
        - redis_client: 已启用字符串响应解码的 Redis 客户端。
        """
        self.redis = redis_client

    @staticmethod
    def _build_key(guest_id: str) -> str:
        """
        构造访客计数对应的 Redis 键。

        参数:
        - guest_id: 浏览器生成并持久化的访客 UUID。

        返回:
        - str: 带业务前缀的 Redis 键。
        """
        return f"{GUEST_USAGE_KEY_PREFIX}:{guest_id}"

    def reserve(self, guest_id: str) -> int:
        """
        为一次文本优化原子预占访客额度。

        参数:
        - guest_id: 浏览器访客 UUID。

        返回:
        - int: 预占后的累计使用次数。

        异常:
        - GuestUsageLimitExceeded: 累计次数已经达到十次。
        """
        key = self._build_key(guest_id)
        # Lua 脚本将递增、过期时间和超限回滚合并为一次原子操作。
        usage_count = int(
            self.redis.eval(
                RESERVE_USAGE_SCRIPT,
                1,
                key,
                GUEST_USAGE_LIMIT,
                GUEST_USAGE_TTL_SECONDS,
            )
        )

        if usage_count == -1:
            raise GuestUsageLimitExceeded

        return usage_count

    def release(self, guest_id: str) -> None:
        """
        在文本优化失败时归还已预占的访客额度。

        参数:
        - guest_id: 浏览器访客 UUID。
        """
        key = self._build_key(guest_id)
        # 原子检查并递减，避免并发失败请求把计数减成负数。
        self.redis.eval(RELEASE_USAGE_SCRIPT, 1, key)

    def commit(self, guest_id: str) -> int:
        """
        将一次执行中的预占额度提交为成功使用次数。

        参数:
        - guest_id: 浏览器访客 UUID。

        返回:
        - int: 当前访客已经成功完成的优化次数。
        """
        key = self._build_key(guest_id)
        return int(self.redis.eval(COMMIT_USAGE_SCRIPT, 1, key))
