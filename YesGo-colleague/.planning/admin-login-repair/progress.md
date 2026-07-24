# 进度记录

## 2026-07-14

- 已创建独立登录修复计划。
- 已检查近期提交和工作区：当前无未提交代码改动；原活动计划与本问题无关。
- 下一步：读取登录前端入口、认证接口、相关测试，并执行最小复现。
- 已读取登录 API 映射、总控登录提交逻辑和后端序列化器；验证码字段映射正确。
- 首次运行认证测试因命令路径错误未执行，已记录；下一步改用 `tests/test_auth_api.py`。
- 后端认证 API：`13 passed`；前端认证相关：`20 passed`。
- 后端验证码与登录风险控制：`12 passed`。
- 已确认后端错误外壳与登录页错误解析不一致；下一步读取前端验证码组件与现有断言，形成并验证最小修复假设。
- Django shell 的首次只读缓存检查因未注入 `DJANGO_SECRET_KEY` 未启动；已按项目约定记录并切换到临时测试密钥。
- 使用临时测试密钥完成缓存健康检查：`REDIS_CONFIGURED=False`、`CACHE_READ=ok`。
- 已测试先行新增两项标准错误响应断言；修复前 `auth.spec.ts` 17 项中 2 项失败，分别显示泛化“登录失败，请稍后重试”。
- 已实施最小修复并重跑认证前端：`auth.spec.ts` 与 `auth-api.spec.ts` 共 `21 passed`。
- 下一步：执行项目规定的后端全量、迁移检查、前端全量与构建，并清理可能的 `server/db.sqlite3` 临时文件。
- 后端全量：`277 passed in 33.26s`；Django 迁移检查：`No changes detected`。
- 前端全量：`34 passed` 文件、`266 passed` 用例，退出码 0；构建退出码 0。全量测试中存在既有 `a-descriptions` 未解析 Vue 警告，未导致失败。
- 已完成 `git diff --check`，无输出；未发现 `server/db.sqlite3`，工作区仅包含本次三处前端修改及本任务规划记录。
- 用户提供浏览器实际错误：`OperationalError (1054) Unknown column control_user.active_mobile_key`。
- 已确认 `iam.0002_remove_controluser_control_user_mobile_unique_and_more.py` 包含该字段和数据回填；本地默认 SQLite 的 `showmigrations` 全未应用，不能作为运行中 MySQL 的迁移状态。下一步检查 Docker backend 并迁移实际服务数据库。
- 已确认本机 8000 端口在受托管 `integrations.exe` 后；Docker 与 WSL 命令不可用，进程环境无法读取。无法安全连接浏览器实际使用的 MySQL 并执行迁移；需要在运行 backend 的环境执行 `python manage.py migrate` 后再验证登录。
- 用户授权 `127.0.0.1:3376` MySQL 后，确认实际库已有列但遗漏 `iam.0002` 迁移记录及索引切换。已安全完成回填、索引切换和迁移登记。
- 验证结果：`iam.0001`、`iam.0002` 均已登记；新唯一索引存在；总控与租户有效手机号回填不一致均为 0。
- 使用不存在的探针账号请求真实总控登录接口，返回标准 400 业务错误 `账号或密码错误。`，确认 schema 错误已消除。
- 已更新 `yesgo_init.sql` 的两张用户表、唯一索引和迁移登记，并新增元数据守护。针对性测试 `17 passed`、全量后端 `278 passed in 35.95s`、迁移检查无变更；已清理测试 SQLite 临时文件。
