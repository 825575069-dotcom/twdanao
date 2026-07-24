# OSS 根目录与头像路径进度

## 2026-07-13

- 已读取现有 OSS 上传实现、类型规则、回归测试、头像 OSS 设计与实施计划。
- 已确认根因：空 `OSS_ROOT_PREFIX` 在 `server/apps/common/upload_services.py` 中被显式拒绝。
- 用户已确认 Bucket 根目录+业务一级子目录的方案，并要求写入规范。
- 当前阶段：准备增加失败回归测试。
- RED 验证：`..\.venv\Scripts\python.exe -m pytest -q tests/test_oss_upload_service.py`，结果 `7 failed, 6 passed`；失败均为空前缀被拒绝或旧目录次序与新规范不符。
- pytest 同时报告 2 条环境警告：当前用户无法写入仓库上级 `.pytest_cache`，不影响测试执行。
- GREEN 验证：同一定向命令结果 `13 passed, 1 warning in 0.10s`。
- 已将 Django 默认值和根目录 `.env.example` 改为空 `OSS_ROOT_PREFIX`；本地根目录 `.env` 已是空值。
- 已新增 `docs/backend/oss-object-directory-standard.md`，并在 `AGENTS.md` 写入强制路径约定；同步修正原头像 OSS 设计文档。
- 用户修正租户隔离标识为 `tenant_id`。先修改测试后定向运行，结果 `11 failed, 18 passed`，失败为旧 `tenant_code` 接口与断言，符合 RED 预期。
- 将上传服务、共享上传 API、旧头像入口及目录模板统一改为 `tenant_id: int | None`后，定向测试 `29 passed, 1 warning in 9.57s`。
- RED 命令前的 `rg` 路径多写了 `server/` 层级，产生一次“系统找不到指定的路径”；pytest 仍正常执行，后续使用当前目录相对路径。
- 后端全量验证：`273 passed, 1 warning in 37.94s`；警告仅为 pytest 无权写入上级 `.pytest_cache`。
- Django 迁移检查：`No changes detected`。
- Web 全量测试：`31 passed` 测试文件、`226 passed` 测试，退出码 0；输出包含既有 Ant Design Vue 测试组件解析警告。
- Web 生产构建：`3368 modules transformed`，`built in 7.87s`，退出码 0；输出包含既有大 chunk 警告。
- Web 依赖使用 `corepack yarn install --frozen-lockfile` 安装，未更新 `yarn.lock`。
