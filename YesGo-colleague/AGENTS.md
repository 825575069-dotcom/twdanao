# AGENTS.md

本仓库是 YesGo 医药行业 SaaS 智能体平台。后续代理应把它视为面向生产演进的多租户、前后端分离平台底座，而不是一次性原型。

## 交流约定

- 与用户交流使用中文。
- 进度汇报要简洁，但必须给出具体证据，例如提交号、测试数量、文件路径。
- 修改代码前先阅读现有实现，保留用户已有改动，不要随意回滚。

## 产品方向

- 平台有三个入口：
  - 总控后台：管理 SaaS 租户、平台资源和平台级指标。
  - 租户后台：配置本租户角色、智能体绑定、规则、模板和智能体参数。
  - 移动端 APP：根据用户在租户内的角色和可见智能体渲染千人千面工作台。
- 平台固定包含五大智能体：
  - `procurement`
  - `operations`
  - `marketing`
  - `distribution`
  - `academic`
- 首个完整业务闭环是采购智能体。运营、营销、流向、学术即使暂未完整闭环，也必须作为平台一等智能体保留配置、权限和扩展入口。

## 硬性架构规则

- 多租户隔离是强约束。租户数据必须在后端按租户隔离，不能只依赖前端隐藏入口。
- 后端目录和模块边界采用“领域为主、入口为辅”的混合分层：领域模块承载模型、规则、服务和查询；总控、租户、移动端、开放接口等入口层只负责认证、权限、参数校验、序列化和路由编排。
- 该分层是默认规范，不是临时方案。新增业务能力时，先判断它属于哪个领域，再决定挂在哪个入口；不要反过来先按入口拆领域。
- 同一业务能力不要按入口复制多套领域逻辑。例如财务、权限、智能体配置、采购任务等应先归属到领域模块，再由总控入口、租户入口或开放接口调用。
- 公共模块只能放真正跨领域的基础能力，例如标准响应、异常、分页、租户上下文、审计基类和通用认证辅助；不要把具体业务规则放进公共模块。
- MySQL 表设计默认不依赖外键约束来保证引用完整性；Django ORM 关系可以保留，但应显式设置 `db_constraint=False`，并通过 service、serializer、management command 和测试做代码层校验。
- 只有当表级外键约束确实能降低风险且不会影响初始化、迁移、补数和历史数据修复时，才允许重新启用数据库外键；默认仍然是“代码层管控优先”。
- 新增或调整表结构时，初始化脚本、迁移文件和模型定义必须一起同步，不能只改其中一处。
- Dify 不允许按租户复制工作流。Dify 侧只维护五个平台级工作流：`procurement`、`operations`、`marketing`、`distribution`、`academic`。
- 五个 Dify 平台级工作流允许各自配置独立 API Key；不要假设单一密钥可调用全部工作流。
- 租户个性化通过调用参数注入，例如 `tenant_code`、`role_code`、`tenant_config`、业务规则、定价偏好、物流权重和上下文内容。
- 运行和集成路线坚持 Docker 优先。Dockerfile、compose、环境变量模板统一放在 `docker/`，不要新建 `infra/`。
- 保持前后端分离：
  - 后端：`server/`，Django + Django REST Framework。
  - 管理后台：`web/`，Vue 3 + Ant Design Vue + Vite，采用 `stepin-template` 方向的后台框架约定。
  - 移动端前端：`mobile/`，固定使用 uniapp，当前重点是移动端壳、工作台页面和接口契约。
- 不要把全部业务逻辑外包给 Dify。平台侧负责租户上下文、权限、任务状态、供应商和业务数据、结果归档、审计和可观测性。

## 目录职责

- `docker/`：Docker Compose、backend/web/worker Dockerfile、环境变量示例。
- `server/yesgo/`：Django 项目配置和 URL 路由。
- `server/apps/`：领域模块目录，按业务能力组织 Django app，负责模型、领域服务、查询、策略和集成抽象。
- `server/apps/common/`：当前公共模块；后续演进时应收敛为跨领域基础能力，必要时可重命名或拆分为 `server/apps/core/`。
- `server/apps/platform/`：平台和租户管理。
- `server/apps/iam/`：用户、角色、租户成员关系、角色-智能体绑定、工作台可见性。
- `server/apps/tenantops/`：五大智能体的租户配置框架。
- `server/apps/procurement_agent/`：采购任务、供应商模型、Dify payload 构建、worker。
- `server/apps/integrations/`：Dify 等外部系统适配层。
- `server/apps/observability/`：智能体调用日志和可观测性基础能力。
- `server/api/`：后续新增入口层时的推荐目录，按 `control/`、`tenant/`、`mobile/`、`openapi/` 等入口组织 DRF views、serializers 和 urls；入口层调用 `server/apps/` 的领域能力，不承载核心业务规则。
- `server/tests/`：pytest 测试。
- `web/src/router/`：Vue Router 路由入口和总控/租户后台路由模块。
- `web/src/layouts/`：总控后台和租户后台 Vue 布局壳。
- `web/src/views/control/`：总控后台页面。
- `web/src/views/tenant/`：租户后台页面，包括五大智能体配置、角色-智能体绑定和采购任务页面。
- `web/src/views/auth/`：总控后台和租户后台登录页面。
- `mobile/src/`：uniapp 移动端页面壳和后续 APP 页面实现。
- `mobile/docs/contracts.md`：移动端工作台接口契约。

## 后端约定

- 按领域组织 Django 应用。跨领域逻辑放在明确的 service 或集成适配器中。
- 新增业务模块时优先建领域 app，例如 `finance`、`agent_platform`、`procurement`；不要优先按入口建 `control_finance`、`tenant_finance` 这类重复业务模块。
- 入口层可以按总控、租户、移动端、开放接口拆分不同 views、serializers、urls 和权限校验；入口层必须调用领域 app 中的 service、selector 或 adapter，不直接复制领域规则。
- 领域 app 内部推荐保持 Django 规范和清晰边界：`models` 定义数据结构，`services` 放写操作和事务，`selectors` 放读查询，`permissions` 放领域权限判断，`serializers/views` 只在该领域没有独立入口层时使用。
- 涉及租户独立和总控全网管控的模块，例如财务模块，应在领域模型和查询中显式包含租户归属，并由租户入口限制为当前租户、总控入口按平台级权限跨租户查询。
- 租户侧 API 必须读取 `X-Tenant-ID`，并在后端校验成员关系和智能体访问权限。
- 业务 API 响应必须使用统一结构，保持前后端契约一致：
  - `code`：业务代码，表示成功、参数错误、权限不足、租户不可用、智能体不可访问等业务状态。
  - `msg`：业务描述，面向前端展示或调试定位，必须与 `code` 含义一致。
  - `data`：响应数据，列表、对象、分页结果或空对象都必须放在该字段内。
- 业务成功响应统一返回 `code=0`、`msg="success"`，实际业务数据放入 `data`；不要在同一项目内混用裸数组、裸对象和标准响应外壳。
- HTTP 状态码仍表达传输和协议层状态，业务判断优先读取标准响应体中的 `code`、`msg`、`data`。
- 业务码定义统一维护在 `docs/backend/api-business-codes.md`；新增、删除或调整业务码时，必须同步更新该文档、公共实现和对应测试。
- 纯消息型错误统一返回 `data={}`，不要返回裸 `detail`，也不要把 `detail` 放进 `data`；字段级校验错误才允许放入 `data`。
- 工作台可见性和权限基于 `TenantMembership`、租户级 `Role`、`AgentBinding`。
- 智能体代码只能使用 `procurement`、`operations`、`marketing`、`distribution`、`academic`。
- Python 依赖安装统一使用阿里云 pip 源；Docker 走 `PIP_INDEX_URL`，本地虚拟环境优先复用 `server/pip.conf`。
- 对有限状态、智能体代码、输入类型等字段，优先使用 `TextChoices`，必要时加数据库 `CheckConstraint`。
- 普通 Django settings 需要 `DJANGO_SECRET_KEY`。测试使用 `server/tests/settings.py`。
- 测试生成的 `server/db.sqlite3` 是临时文件，提交前必须删除。

## 前端约定

- `web/` 当前同时承载总控后台和租户后台壳。
- 管理后台前端框架已确定为 Vue 3 + Ant Design Vue + Vite + TypeScript + Pinia + Vue Router，并按 `stepin-template` 的后台信息架构和组件风格演进。
- 前端后台路由前缀固定：总控后台一律使用 `/control/...`，租户后台一律使用 `/tenant/...`；不得新增或保留 `/platform/...` 作为总控前端路由。总控中的租户管理资源统一放在 `/control/tenant/...`，包括租户列表、成员、套餐和租户详情；例如套餐为 `/control/tenant/package`，租户详情为 `/control/tenant/:id`。该约定仅适用于前端页面路由、菜单路径、页面直跳、登录重定向和权限种子中的 `route_path`，不改变后端 API 的 `/api/control/...`、`/api/tenant/...` 前缀。后续可由域名网关隐藏 `/control` 或 `/tenant` 前缀，但应用内部路由必须保持本约定。
- 枚举类、单选型字段若可选项不超过 5 个，前端统一使用单选框/单选组，不要使用下拉框。
- 路由和布局优先沿用 `web/src/router/index.ts`、`web/src/router/modules/control.ts`、`web/src/router/modules/tenant.ts`、`web/src/layouts/ControlLayout.vue`、`web/src/layouts/TenantLayout.vue`。
- 所有管理后台菜单的 `code`、`route_path`、Vue Router `path`、菜单 key、登录/页面直跳与初始化权限种子中的资源词统一使用单数，例如 `role`、`tenant`、`member`、`package`、`integration`、`setting`、`log`、`issue`、`feedback`；该约定不适用于 REST API 集合路径、领域目录、模型关系、普通英文文案或 OSS 对象目录。
- 页面优先放在 `web/src/views/control/`、`web/src/views/tenant/`、`web/src/views/auth/`，不要新增 React、React Router 或 TSX 页面结构。
- 前端统一使用 `yarn`，并通过 `web/.npmrc` / `web/.yarnrc` 固定到阿里云镜像源。
- 列表页默认展示 `ID` 字段，且默认按 `id` 倒序；如果某个列表有明确业务排序要求，必须显式写出来，不要依赖隐式默认值。
- 列表页筛选项默认按以下顺序排列：支持切换租户时，租户筛选置于第一位；其后依次为时间范围筛选、枚举值筛选、文本输入筛选。同类筛选项按业务重要性排序；无租户切换需求时，从时间范围筛选开始。
- 涉及行政区划的列表筛选统一使用 Ant Design `Cascader` 的省、市、区/县、街道/乡镇四级懒加载联动（项目封装为 `DivisionFilterCascader`）；区域展示列必须保持单行，必要时使用省略与悬浮完整提示，不得逐字换行。
- 列表中的枚举值筛选统一使用下拉框；详情和编辑表单不受此约束。
- 列表筛选中的“所属租户”统一使用租户选择弹窗，选中后回填租户 ID 与名称，触发控件使用 Ant Design 的切换箭头；“租户 ID”等精确数值查询不适用此规则。
- 需要精确字段或高相关字段检索时，使用 Ant Design 的字段下拉框与关键词输入框组合控件；页面必须明确默认字段及字段到查询参数的映射。
- 所有下拉框与切换型选择控件必须保持一致的控件高度、水平内边距和箭头留白；宽度应按内容与页面空间自适应，避免无意义的大面积留白。
- 列表中的切换型选择控件在用户确认选择后必须自动触发当前筛选，不要求用户再次点击“搜索”；文本输入等非切换条件仍由页面既有搜索交互决定。
- 列表中的实体切换弹窗（包括“所属租户”）统一遵循以下样式与交互：
  - 使用 Ant Design `Modal`，弹窗宽度以表格单行完整展示为优先，并在窄屏时限制为 `calc(100vw - 32px)`；不得为装饰性大留白放大头部或四周间距。
  - 标题与 `StandardListTable` 卡片标题保持一致：仅显示 16px、600 字重的文字，不使用色条、图标或其他装饰。
  - 标题分隔线、搜索区、表格与底部操作区使用同一条左右对齐线，水平留白统一为 16px（与列表筛选区一致）；纵向间距保持紧凑。
  - 精确搜索使用 `a-space-compact` 组合“字段下拉框 + 关键词输入框”，控件与搜索按钮统一 32px 高度；表格使用单选行，确认前不改写外层筛选条件。
  - 租户选择弹窗固定展示 `ID`、`租户名称`、`平台名称`、`租户状态`、`平台状态`；可按 `租户 ID`、`平台名称`、`租户名称` 精确检索。确认选中后回填 ID 与名称并立即自动筛选。
- 列表数据默认过滤软删除记录；仅在明确业务入口中由用户主动勾选或切换（例如后台列表的 `已删记录`）时，才允许请求和展示软删除数据。
- 列表空状态统一展示 `暂无数据`，不要暴露 Ant Design 默认英文 `No data`。
- 列表操作按钮统一：主动作高亮、次动作普通、危险动作红色；同一列表内动作顺序和视觉层级必须一致。
- 所有真实调用后端写接口的表单，在接口成功返回后必须展示可见的保存成功提示；通用文案使用“保存成功”，业务动作可使用更具体的“XX 已保存”。需要跳转时先发布提示再跳转。校验失败、请求失败和未接入接口的占位页不得伪造成功提示，保存请求期间必须使用 loading 或等价禁用状态防止重复提交。
- 详情表单的数字字段优先使用 `StandardNumberInput`，主提交按钮统一命名为“保存”；具体字段范围、步长和精度必须显式声明。
- 移动端前端统一使用 uniapp，代码放在 `mobile/`；除非任务明确要求，不要把 `mobile/` 扩展成完整 APP，当前重点是壳、工作台页面和契约。

## Dify 与智能体约束

- `server/apps/procurement_agent/result_builder.py` 是当前 Dify payload 策略参考实现。
- `workflow_code` 只能是五个平台级工作流之一。
- 租户差异必须进入 `inputs`，尤其是 `tenant_config`。
- 采购任务状态应保持以下集合：
  - `pending`
  - `processing`
  - `succeeded`
  - `failed`
  - `partial_succeeded`
- 后续 Kafka 消费逻辑应包装现有 worker/service 行为，不要绕过现有任务状态和结果归档。

## 常用命令

后端测试：

```powershell
cd server
..\.venv\Scripts\python.exe -m pytest -q
```

迁移检查：

```powershell
cd server
$env:DJANGO_SECRET_KEY='test-secret'
..\.venv\Scripts\python.exe manage.py makemigrations --check --dry-run
```

前端测试和构建：

```powershell
cd web
yarn test -- --runInBand
yarn build
```

Docker 启动命令：

```powershell
docker compose -f docker/compose.yml --env-file docker/.env.example up --build
```

## 环境变量规范

- 业务配置环境变量只允许放在仓库根目录 `.env`。
- `docker/` 目录只保留容器编排、镜像构建和环境变量示例，不承载业务配置的真实 `.env`。
- 新增业务环境变量时，优先同步根目录 `.env` 及对应的根目录模板，不要把业务配置写进 `docker/.env` 或 `docker/.env.example`。

## OSS 对象目录规范

- `OSS_ROOT_PREFIX` 允许留空，留空表示直接使用 Bucket 根目录；非空值仅用于环境级命名空间，必须是不含 `..` 和反斜杠的相对路径。
- Bucket 根目录下按业务划分一级目录，不允许各入口或业务自行定义顶层路径。
- 头像路径固定为 `avatars/control/accounts/{account_id}/YYYY/MM/{uuid}.{ext}` 或 `avatars/tenants/{tenant_id}/accounts/{account_id}/YYYY/MM/{uuid}.{ext}`。
- 品牌资源使用 `branding/tenants/{tenant_id}/{resource_type}/YYYY/MM/{uuid}.{ext}`；采购附件使用 `procurement/tenants/{tenant_id}/attachments/YYYY/MM/{uuid}.{ext}`。
- OSS 路径中的租户隔离标识必须使用数据库 `tenant_id`，不得使用可变的 `tenant_code`、租户名称或域名。
- 新增 OSS 业务必须先在 `docs/backend/oss-object-directory-standard.md` 登记一级业务目录、租户隔离层级、文件命名与生命周期策略。

Nginx 本地域名示例：

- `docker/nginx/local.yesgo.86lw.cc.conf`

## 完成前验证

声明完成前，必须运行相关验证并报告真实输出：

- 后端：`pytest -q`
- Django 迁移：`makemigrations --check --dry-run`
- Web 测试：`yarn test -- --runInBand`
- Web 构建：`yarn build`
- Git 状态：`git status --short`

如果命令因本地环境缺少依赖而失败，要明确说明是环境问题，不要包装成代码失败或代码成功。

## 开发流程

- 新功能和 bugfix 优先测试先行。
- 提交保持小而聚焦。
- 不要回滚无关的用户改动。
- 未经明确要求，不要运行破坏性 git 命令。
- 较大阶段建议使用 worktree 分支，验证通过后再合并回 `dev`。
- 运行测试后清理 `server/db.sqlite3` 等临时文件。
- 长任务必须使用 `planning-with-files` 跟踪，并同时按 `superpowers` 的流程执行。
- 预计跨多个阶段、多个模块或 5 次以上工具调用的任务，应先在 `.planning/<task-id>/` 下维护 `task_plan.md`、`findings.md`、`progress.md`，再开始实质修改。
- `planning-with-files` 产出的 `task_plan.md`、`findings.md`、`progress.md` 默认使用简体中文书写；只有代码标识、命令、错误原文、接口字段和第三方专有名词保留原文。
- `superpowers` 负责选择和约束工作流程，例如 brainstorming、TDD、系统化调试、验收和收尾；`planning-with-files` 负责持久记录目标、阶段、发现、错误和验证结果。
- 对同一长任务，`.planning/.active_plan` 指向当前活动计划；恢复会话或上下文压缩后，应先读取活动计划、发现和进度，再继续执行。
- 每完成一个阶段或遇到重要错误后，必须同步更新 `task_plan.md` 与 `progress.md`；调研结论、接口契约、环境差异和关键决策记录到 `findings.md`。

## 第二阶段建议方向

用户要求继续时，建议优先按以下顺序推进：

1. 让 Docker Compose 不只启动依赖，还能启动 Django backend 和 web app。
2. 补采购异步任务投递、状态查询和标准化三方案结果结构。
3. 建租户后台角色-智能体映射配置页面。
4. 让移动端工作台消费 `/api/me/workbenches/` 并按角色渲染入口。
5. 为运营、营销、流向、学术补最小 API 闭环，同时保持固定五套 Dify 工作流加租户参数化策略。
