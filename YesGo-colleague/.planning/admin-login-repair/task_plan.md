# 后台登录失败修复计划

## 目标

定位后台登录失败的根因，补充可复现的自动化测试并以最小改动修复，同时验证总控与租户认证链路不回归。

## 阶段

- [x] 阶段 1：收集错误、复现失败并检查近期认证改动
- [x] 阶段 2：对比正常认证路径，确认单一根因与修复假设
- [x] 阶段 3：测试先行实施最小修复
- [x] 阶段 4：同步运行数据库迁移并验证真实登录链路

## 约束

- 保留现有用户改动，不修改无关表单规范计划中的文件。
- 认证与授权分离：启用但无角色的账号可登录，菜单可为空。
- 修复前必须保留失败复现与根因证据。

## 错误记录

| 错误 | 尝试 | 处理 |
|---|---:|---|
| 规划技能的默认用户目录脚本不存在 | 1 | 改用仓库已加载的 `E:\www\YesGo\.codex\skills` 路径并继续独立记录本任务 |
| 在 `server/` 目录执行测试时误带 `server/` 前缀 | 1 | 改用相对路径 `tests/test_auth_api.py`，不重复同一命令 |
| 从 `server/` 目录读取仓库路径时重复使用根目录前缀 | 1 | 测试已正常执行；后续跨前后端读取统一回到仓库根目录 |
| 直接启动 Django shell 缺少必需的 `DJANGO_SECRET_KEY` | 1 | 使用项目规定的临时测试密钥重跑只读缓存健康检查 |
| 在 `server/` 目录读取迁移文件时重复加入 `server/` 前缀 | 1 | 已通过检索确认迁移内容；后续从仓库根目录读取并检查容器运行状态 |
| 当前工作区无 Docker/WSL，且 8000 端口由受托管 `integrations.exe` 提供 | 1 | 无法取得运行中 MySQL 连接环境或直接执行迁移；向用户提供受控迁移命令并等待可执行运行环境 |
| 首次写入迁移记录的命令字符串引号转义错误 | 1 | 字段回填及索引切换已成功；改用参数化 SQL 单独登记 `iam.0002`，验证成功 |
| PowerShell 的 HTTP 异常对象不提供 `GetResponseStream()` | 1 | 改用 `curl.exe` 进行无真实账号的登录 schema 探针，返回预期业务错误 |

## 根因与决策

- 根因：两套登录页只读取历史 `detail` 错误字段，后端现行标准错误响应使用 `msg`。因此登录接口返回的明确业务错误被错误降级为“登录失败，请稍后重试”。
- 修复：保留历史 `detail` 兼容性，并在不存在 `detail` 时读取标准响应 `msg`；总控和租户登录页同步修复。
- 新证据：浏览器真实接口报 MySQL `1054 Unknown column control_user.active_mobile_key`。该列已由 IAM `0002` 迁移定义，但正在服务的 MySQL 实例尚未应用该迁移；需要对实际 backend 容器执行受控迁移。

## 验证结果

- 后端全量：`277 passed in 33.26s`。
- Django 迁移检查：`No changes detected`。
- 前端全量：`34 passed` 文件、`266 passed` 用例（既有 Vue stub 警告未影响退出码）。
- 前端构建：成功；保留既有的 bundle 大小告警。
- `git diff --check` 无输出；已确认不存在 `server/db.sqlite3` 临时文件。
- 当前未完成：真实 MySQL 尚需执行 IAM `0002`，受运行环境访问限制无法在本线程代为执行。

## 真实 MySQL 修复结果

- 连接：用户授权的 `127.0.0.1:3376/yesgo`。
- 原状态：两张表均已有 `active_mobile_key`，但 `django_migrations` 仅登记 `iam.0001`，且仍保留旧手机号唯一索引。
- 已执行：回填有效用户的 `active_mobile_key`、移除 `control_user_mobile_unique` 与 `tenant_user_tenant_mobile_unique`、建立新索引、登记 `iam.0002_remove_controluser_control_user_mobile_unique_and_more`。
- 验证：新迁移记录存在；两张表的新唯一索引存在；有效手机号回填不一致数均为 `0`。
- HTTP 验证：向真实 `/api/control/auth/login/` 提交一个不存在的探针账号，获得 `400 {"code":1001,"msg":"账号或密码错误。","data":{}}`，未再出现 `1054` 数据库列错误。
- 初始化 SQL：已同步 `active_mobile_key`、两项新唯一索引与 `iam.0002` 初始迁移记录，避免新库再次出现结构/迁移记录脱节。
- 验证：初始化 SQL 元数据测试 `17 passed`；后端全量 `278 passed in 35.95s`；迁移检查 `No changes detected`。
