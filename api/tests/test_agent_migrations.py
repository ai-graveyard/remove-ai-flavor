import importlib.util
from pathlib import Path
from types import ModuleType, SimpleNamespace


VERSIONS_DIR = Path(__file__).resolve().parents[1] / "alembic" / "versions"


def _load_migration(filename: str) -> ModuleType:
    """
    按文件名加载 Alembic 迁移模块。

    参数:
    - filename: versions 目录中的迁移文件名。

    返回:
    - ModuleType: 可直接调用 upgrade 的迁移模块。
    """
    path = VERSIONS_DIR / filename
    spec = importlib.util.spec_from_file_location(path.stem, path)
    assert spec and spec.loader
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


def test_agent_migrations_skip_when_fresh_database_has_no_agent_table(monkeypatch) -> None:
    """全新数据库没有 agent 表时，历史兼容迁移不应执行列或数据操作。"""
    migrations = [
        _load_migration("44ed2273699a_add_required_membership_type_to_agent.py"),
        _load_migration("a9f3c2d1e4b5_retire_dify_agents.py"),
    ]
    inspector = SimpleNamespace(has_table=lambda table_name: False)

    for migration in migrations:
        monkeypatch.setattr(migration.op, "get_bind", lambda: object())
        monkeypatch.setattr(migration.sa, "inspect", lambda bind: inspector)
        monkeypatch.setattr(
            migration.op,
            "execute",
            lambda statement: (_ for _ in ()).throw(AssertionError("不应执行 SQL")),
        )
        migration.upgrade()
