# OSS 根目录与头像路径修复计划

## 目标

允许 `OSS_ROOT_PREFIX` 为空以直接使用 Bucket 根目录，将头像及现有上传资源统一为“业务一级目录”布局，并写入项目规范。

## 阶段

- [x] 阶段 1：确认根因与目录方案
- [x] 阶段 2：先补回归测试并确认 RED
- [x] 阶段 3：实现空根前缀和业务目录对象键
- [x] 阶段 4：更新环境变量示例、设计文档和项目规范
- [x] 阶段 5：运行定向及全量验证，检查 Git 状态

## 目录决策

- 根目录头像：`avatars/control/accounts/{account_id}/YYYY/MM/{uuid}.{ext}`
- 租户头像：`avatars/tenants/{tenant_id}/accounts/{account_id}/YYYY/MM/{uuid}.{ext}`
- 品牌资源：`branding/tenants/{tenant_id}/{logo|logo-inverse|favicon}/YYYY/MM/{uuid}.{ext}`
- 采购附件：`procurement/tenants/{tenant_id}/attachments/YYYY/MM/{uuid}.{ext}`
- 非空 `OSS_ROOT_PREFIX` 仅作可选环境命名空间，拼接在上述路径之前。

## 错误记录

| 错误 | 尝试 | 处理 |
|---|---:|---|
| `session-catchup.py` 在默认用户技能路径不存在 | 1 | 本项目技能位于仓库 `.codex/skills/`，已改为直接检查活动计划和 Git 状态 |
| `codex-tools.md` 首次路径推断错误 | 1 | 用 `rg --files` 定位后已完整读取 |
| PowerShell 找不到 `yarn.cmd` | 1 | 改用系统已安装的 `corepack yarn` |
| Corepack 在沙箱内无权读取用户缓存 | 1 | 经批准后在沙箱外运行限定前缀 `corepack yarn` |
| Web 缺少 `node_modules/vitest/vitest.mjs` | 1 | 用 `corepack yarn install --frozen-lockfile` 按锁文件安装依赖，未修改锁文件 |
