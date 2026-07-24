# 进度日志

## 2026-07-21

- 已确认范围为全部已实现列表页。
- 已获用户认可设计，设计文档提交为 `affd338`。
- 已生成实施计划，尚未开始生产代码改动。
- 已创建隔离 worktree `E:\www\YesGo\.worktrees\list-filter-layout`（分支 `codex/list-filter-layout`），并完成前端依赖安装。
- 基线全量前端测试：1 条失败，其余通过；失败为 `src/views/control/control-system-settings.spec.ts` 的既有提示文案断言，与本任务无关。
- 已在 `codex/list-filter-layout` 完成并提交 `b1f567b`：统一 `StandardListTable` 窄屏筛选布局；重排登录日志、操作日志、租户成员、租户管理和采购任务页面的筛选项；为独立日志页补齐筛选容器样式与顺序回归测试。
- 验证：相关测试 26 项通过；`yarn build` 成功；全量测试仍为同一条既有失败。
- 已确认租户列表“所在区域”不是接口编码错误：后端 `TenantSerializer.get_region_path` 正常返回省/市/区/镇名称；问题来自窄屏下 11 个未设宽度的列互相挤压，区域文本逐字换行。
- 已为 `StandardListTable` 增加按页面声明的横向滚动能力，并在租户管理页设置 1740px 表格宽度和稳定列宽；筛选区保持“枚举下拉框优先、文本框在后”的统一顺序，并补全文本输入提示。
- 验证：`standard-list-table.spec.ts` 与 `list-filter-order.spec.ts` 共 27 项通过；`control-pages.spec.ts` 有 3 项与此前租户成员弹窗改造的旧断言不一致，均与本次区域列宽改动无关。
- 租户管理新增“所在区域”省、市、区/县、街道/乡镇四级联动筛选，复用 `DivisionCascader` 与既有 `/api/control/divisions/` 接口；区域列改为固定单行、溢出省略并支持悬浮完整查看，避免窄屏逐字换行。已同步写入 `AGENTS.md`。
- 验证：区域筛选规范回归测试通过，`yarn build` 成功。尝试查询当前本地 Django 数据库以排查编码，但该库没有租户数据；浏览器运行环境使用的是另一套数据源。
- 已从浏览器实际返回值确认区域名称为 UTF-8 被 CP1252 / Latin-1 错误解码的历史数据。服务端新增兼容输出：租户 `region_path` 与 `/api/control/divisions/` 选项都会恢复正常中文，正常中文不受影响；回归测试覆盖两类乱码。
- 验证：`tests/test_platform_tenant_list_api.py` 与 `tests/test_control_division_api.py` 共 8 项通过；迁移检查 `No changes detected`。
- 按用户提供的 Ant Design Cascader 官方规范，将租户列表区域筛选由四个并列下拉框替换为单一 Ant `Cascader` 组件，使用既有行政区划 API 按层级懒加载、允许逐级筛选与清空；已更新前端规范。
- 验证：列表筛选回归测试通过，`yarn build` 成功。
- 用户修复数据库后继续反馈页面乱码。链路核对确认前端 `TenantListView.vue` 的 `mapRow` 仅透传 `region_path`，不进行编码转换；因此页面所见乱码必然来自接口响应。当前运行页面中同一字段内“北京市/天津市”正常、后续名称乱码，也排除了整条 HTTP 响应以错误字符集解码的可能，待核对正在运行后端是否已加载本次序列化修复及其实际连接数据源。
- 后端接口回归复验：`tests/test_platform_tenant_list_api.py`、`tests/test_control_division_api.py` 共 `8 passed`；序列化层与行政区划接口均能把该类历史乱码输出为正确中文。本机未发现 Django/Python 服务进程，当前 `localadmin` 服务需在其实际运行环境重载后端代码后再验证。
- 已通过本机 WSL 的 `yesgo-backend` 容器定位并修复真实根因：部分行政区划名称混用了 CP1252 可显示字符与 Latin-1 C1 控制字符，原有“固定单一字符集”的单轮修复会在第三、四级名称提前停止。`repair_legacy_utf8_mojibake` 现按单字符保留 C1 字节、映射 CP1252 可显示字符后，再最多还原三轮；新增真实样本回归测试。
- 验证：相关后端测试 `10 passed`（3 条既有 Django 弃用警告）；运行容器内对真实租户区域字段进行 Unicode 精确比较返回 `tenant_region_utf8_ok=True`。`yesgo-backend` 已热重载（日志显示 `/app/server/apps/platform/text.py changed, reloading.`），容器状态正常。
