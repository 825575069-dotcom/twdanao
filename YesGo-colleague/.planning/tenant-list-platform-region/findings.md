# 调研发现

## 当前实现

- `Tenant` 已包含联系人、四级行政区划外键、详细地址、租户状态与创建时间。
- `TenantPlatform` 已通过 `OneToOneField` 关联租户，并包含平台名称、域名、站点品牌配置和平台状态；关系设置了 `db_constraint=False`。
- 当前租户列表 API 使用 `TenantSerializer` 嵌套只读 `platform`，查询已 `select_related("platform")`，但按 `id` 升序。
- 当前前端租户列表仍使用旧字段：租户编码、API 配额、存储配额和成功率，与当前后端模型契约不一致。
- 当前租户详情页仍使用旧字段，并通过拉取整个列表查找单条记录；只更新旧的状态和配额字段。
- 系统设置页通过 `SettingsShell` 实现左侧分组、右侧内容；可复用其信息架构呈现“基础设置/平台设置”。
- `Division` 已具备省、市、区、镇四级树形数据基础，但尚未确认现有查询 API 与前端通用组件。

## 初步差距

- 需要为列表输出区域名称路径，而不是只有四个 ID。
- 需要明确租户基础字段和平台字段是否通过一个聚合接口原子保存。
- 需要为通用区域联动补查询契约、逐级清空逻辑和可配置最大层级。
- 需要检查 `TenantPlatform` 缺失时的列表/详情兼容策略，以及创建租户时是否必须同步创建平台。

## 补充调研

- 总控平台路由目前只有租户列表/创建、租户详情更新和独立的 `admin-site` 管理接口，没有行政区划查询接口。
- `SettingsShell` 已封装 224px 左侧导航和右侧内容区，小屏自动改为单列，可直接承载“基础设置/平台设置”。
- 现有租户 API 测试已覆盖统一响应外壳、基础字段更新、嵌套平台读取与 Bearer Token 权限，但未覆盖区域名称路径、ID 倒序、平台聚合写入和区划父子链校验。
- 行政区划初始化 SQL 已存在于 `server/sql/mysql/init/yesgo_division_init.sql`，本次若不改表结构，仅新增查询接口，无需迁移或调整初始化 SQL；仍需运行迁移一致性检查。
- 前端测试集中在 `web/src/tests/control-pages.spec.ts`，已有租户列表和详情用例，适合原位按新契约做 TDD。
- 现有 `TenantSiteConfigView.vue` 使用了 `admin_domain`、`login_title`、`logo_url`、`logo_inverse_url`、`primary_color` 等旧契约字段，其中多数字段不属于当前 `TenantPlatform` 模型；整合时应以现行模型字段为唯一真实来源，不能继续保留虚假保存字段。
- 当前 `TenantPlatform` 实际全字段为：`name`、`status`、`domain`、`site_title`、`logo_admin_top_url`、`logo_admin_top_small_url`、`favicon_url`、`copyright_text`、`icp_text`、`police_record_text`。
- OSS 上传组件已支持租户品牌 Logo、反白 Logo、favicon；可在平台设置中复用并映射到现行两个管理侧 Logo 字段和 favicon 字段。
- 原独立站点配置 API 返回裸对象，与项目统一响应规范不一致；聚合到租户详情接口后应统一使用 `code/msg/data` 外壳，旧接口暂时保留给其他消费者，避免扩大无关范围。

## 需要确认的业务选择

- 已确认：编辑页“平台设置”包含 `TenantPlatform` 全部字段，即平台名称、平台域名、站点标题、管理侧顶部 Logo、缩小 Logo、favicon、版权、ICP、公安备案和平台状态，并整合现有站点配置能力。
- 已确认：历史租户没有 `TenantPlatform` 时，保存“平台设置”自动创建平台记录；已有记录则更新，继续依靠一对一关系防止重复。

## 已确认设计

- 采用聚合接口方案：租户详情与嵌套 `platform` 由同一详情接口读取和部分更新，平台分组出现时在事务内创建或更新平台。
- 基础设置包含租户名称、统一社会信用代码、联系人、四级区域、详细地址和租户状态。
- 平台设置只使用 `TenantPlatform` 现行全部字段，并复用 OSS 上传能力。
- 新增通用 `DivisionCascader`，通过 `levels=1..4` 控制联动深度；租户配置使用四级，数据按父级懒加载，切换父级清空后代。
- 行政区划写入必须验证层级正确和父子链连续；列表由后端输出 `/` 分隔的 `region_path`。

## 2026-07-15 路由调研

- 用户重新拉取代码后说明：总控租户相关路径应以 `tenant` 为路由基准。
- 当前工作树仍可检索到旧复数路径：前端详情为 `/platform/tenants/:id`，前端 API 为 `/api/platform/tenants/`，后端路由也为 `tenants/`。
- 已确认前后端均调整：页面路由基准为 `/platform/tenant`，总控 API 基准为 `/api/control/tenant`；行政区划总控读取接口为 `/api/control/divisions/`。
- 已确认行政区划必须抽离为通用数据层、通用组件层和租户业务适配层；组件不得包含租户 ID 或四个租户区划字段名。
