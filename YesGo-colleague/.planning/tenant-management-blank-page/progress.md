# 进度

## 2026-07-20

- 已开始按系统化调试流程排查侧边栏空白页。
- 尝试运行 planning-with-files 的 session-catchup 脚本，但当前安装路径未提供该脚本；改用 Git 状态与源码路由链进行恢复。
- 已完成无登录态浏览器复现：路由被认证守卫重定向，未复现主内容空白；开始比较租户列表、租户成员页面的共同加载链。
- 失败回归测试复现成员页挂载钩子未处理拒绝；已为成员页和列表页补充接口失败回归测试，并完成空数组兜底。定向 `control-pages.spec.ts` 73/73 通过，未再报告该未处理错误。
- 完整前端测试通过（47 文件、321 测试），生产构建通过；准备提交 3 个前端代码与测试文件。
- 收到用户确认 `/control/tenant/list` 为正确既定地址。已完成路由链核对并新增预期失败的路由解析回归断言，准备执行 RED 验证。
- RED 验证完成：`router.resolve("/control/tenant/list")` 触发与用户相同的 `No match found` 警告并返回 `undefined`。确认仅是前端路由缺少该地址别名。
- 首次实现将 `alias: undefined` 传入所有无别名菜单，Vue Router 在初始化时抛出 `aliases is not iterable`；已定位为字段应省略而非传 `undefined`，正在进行单点更正。
- 路由别名修正后，定向 `src/router/router.spec.ts` 通过（6/6）；完整前端测试通过（47 文件、321 测试），生产构建通过。构建仅报告原有的单包体积超过 500 kB 提示。
- 用户要求将租户反馈路径改为 `/control/tenant/feedback`，并明确不保留旧地址。已完成菜单、路由与权限种子的范围核对，开始测试先行实施。
- RED 验证完成：前端路由与菜单断言 3 项失败，MySQL 初始化 SQL 元数据断言 1 项失败；均因仍为 `/platform/tenant/feedback`。首次实现补丁发现 SQL 实际位于仓库根目录 `sql/`，已更正目标路径。
- 完整后端 pytest 首次运行 377 通过、1 失败：`test_control_tenant_feedback_seed_uses_frontend_menu_route` 仍断言旧 `/platform` 契约。已将该现有回归断言同步到用户确认的 `/control` 正式路径，准备重跑完整后端测试。
- 后端完整 pytest 再验收时，375 项通过后有 3 项因系统临时目录 `C:\\Users\\xxxdh\\AppData\\Local\\Temp\\pytest-of-xxxdh` 的权限错误退出；与路由代码无关。下一次将使用工作区专用 `--basetemp` 隔离测试临时文件。
- 专用临时目录验证完成：完整后端 pytest 378/378 通过。前端完整测试 47 文件、321 测试通过，生产构建通过，Django `makemigrations --check --dry-run` 输出 `No changes detected`。已清理 `.pytest-tmp-control-feedback`。
- 用户要求继续。完成总控租户管理路由链审计，确认成员、套餐及详情仍有 `/platform/tenant/*` 残留；开始以统一 `/control/tenant/*` 为目标补充回归测试。
- RED 后统一了列表、成员、套餐、反馈及详情页路由；定向路由与布局测试 31/31 通过。首次前端全量测试有 379/381 通过，余下 2 项仅为 `control-pages.spec.ts` 对列表/成员详情旧路径的断言，已同步为 `/control` 后重跑。
- 更新页面跳转断言后，`control-pages.spec.ts` 85/85 通过；完整前端测试 53 文件、381 测试通过，生产构建通过。
- 最后一轮审计确认菜单四入口、后端种子、MySQL 初始化数据与列表/成员/套餐详情路由均已统一使用 `/control/tenant/*`，未发现新的未匹配路径。
