# AGENTS.md 标准化审计发现

## 用户要求

- 重新整理 Agent 项目指令。
- 检查是否存在遗漏。
- 形成标准化、结构化、适合长期迭代的内容。
- 用户确认将 `AGENTS.md` 体系视为开发智能体 Harness，并允许采用分层结构。

## 技术决策

| 决策 | 理由 |
| --- | --- |
| 采用根级总纲与分目录规则组成 Harness | 让全局硬约束保持稳定，同时使后端、Web、移动端、Docker 规则就近维护 |
| 调整为“根入口 + 独立 Harness 目录” | 用户明确要求所有分层规则集中存放在独立文件夹，而不是散落到业务目录 |
| Hook 采用守卫型策略 | 用户明确选择；修改操作在规则清单、路径映射或分层文件异常时失败关闭，读操作保持可用 |

## 当前发现

- 根目录 `AGENTS.md` 已覆盖产品方向、架构、目录、后端、前端、Dify、环境变量、OSS、验证和开发流程。
- 当前文件将长期稳定原则、当前实现状态、页面级 UI 细则、操作命令和“第二阶段建议”混合在同一层级，后续维护容易继续膨胀。
- `AGENTS.md` 有未提交的列表筛选弹窗规范，必须在重组时完整保留。
- 当前 `.planning/.active_plan` 指向 `list-filter-layout`；该计划内容已显示阶段完成，但 `progress.md` 仍有未提交修改，不能覆盖或回滚。
- 仓库目前只有根目录 `AGENTS.md`，尚未建立 `server/`、`web/`、`mobile/` 等分目录级代理说明。
- 后端实际领域 app 比现有目录职责多出 `finance`、`scheduler`、`tenant_feedback`，说明目录清单已出现遗漏。
- `server/api/` 已实际存在；需要进一步核对它是否已按入口边界落地，避免继续写成“后续推荐目录”。
- `web/src/` 实际还包含 `features/`、`composables/`、`app/` 等结构，当前目录职责只覆盖路由、布局和视图，不足以指导长期组件与功能组织。
- 仓库已有专题规范：`docs/database/数据库设计规范.md`、`docs/frontend/admin-list-standard.md`、`docs/backend/api-business-codes.md`、`docs/backend/oss-object-directory-standard.md`、部署与验收文档。根 `AGENTS.md` 可保留强约束并索引这些权威细则，降低重复和漂移。
- 根目录存在真实 `.env` 和 `.env.example`，同时 `docker/` 下也存在 `.env` 与 `.env.example`；这与“业务配置只允许根目录 `.env`、docker 只保留示例”存在至少表述或仓库状态上的冲突，需明确区分编排变量与业务配置。
- 仓库已有受版本控制的 `.codex/hooks.json` 和完整 Hook 适配层，可在不替换 `planning-with-files` Hook 的前提下追加 Harness Hook。
- `.agents/` 目录目前为空且未被 Git 跟踪，适合作为集中存放分层 Harness 的位置。
- 现有 `SessionStart` 会调用 `user-prompt-submit.sh`，`UserPromptSubmit` 也已有独立触发点；新增 Harness Hook 应作为并列 Hook，避免把新职责耦合进规划脚本。
- `UserPromptSubmit` 的现有脚本通过标准输出注入上下文；`PreToolUse` Python 适配器支持 JSON `systemMessage`，但当前只匹配 `Bash`。路由策略需要在上下文完整性与重复注入成本之间取舍。

## 待核对

- 根目录和 `server/`、`web/`、`mobile/`、`docker/` 的真实目录与配置是否匹配现有描述。
- 是否已有更权威的专题文档可承载 API、OSS、UI、Dify、部署等细则。
- 常用命令是否与当前 package scripts、pytest 配置、compose 文件一致。
- 是否缺少安全、数据迁移、日志脱敏、依赖变更、兼容性、文档同步、代码所有权等长期维护规则。
- `.env` 文件是否被 Git 忽略，以及 `docker/.env` 是否仅为本地编排变量，避免错误建议删除用户环境文件。

## 资料

- `E:\www\YesGo\AGENTS.md`
- `E:\www\YesGo\.planning\list-filter-layout\task_plan.md`
- `E:\www\YesGo\.codex\skills\planning-with-files\SKILL.md`
