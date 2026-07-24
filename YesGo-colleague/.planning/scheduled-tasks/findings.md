# 调研发现

## 当前情况

- 采购智能体运行时模型已移除，租户采购任务 API 暂统一返回“开发中”。
- 采购入口已具备 `X-Tenant-ID`、成员关系及智能体可访问性校验模式，可作为租户定时任务入口的权限参考。
- 当前活动计划属于“租户列表、平台设置与通用区域联动调整”，与本任务无关；本任务将单独维护 `scheduled-tasks` 计划。

## 运行环境

- 当前 Docker Compose 仅运行 backend、web、MySQL、Redis；`worker.Dockerfile` 只是保持存活的占位容器，未配置 Celery、beat 或其他调度器。
- Django 当前没有任务调度依赖或全局调度配置；新增执行器需要作为独立 worker/management command 运行，不能耦合到 Web 请求进程。
- 已存在总控菜单权限 `control-system-scheduler`，可作为总控调度管理入口的权限基础；暂未找到相应页面或 API。
- 通用 Shell 命令具有宿主机与容器逃逸风险，需要在设计阶段明确命令来源、审核权与执行容器权限，不能直接把租户可编辑文本传给 `shell=True`。

## 总控入口

- 总控已预置 `control-system-scheduler` 菜单项及 `ScheduleOutlined` 图标，但其路由当前会回退到“开发中”页；可以在不增设菜单权限的前提下接入正式页面。
- 总控 API 目前由 `server/api/control/` 入口汇聚；该入口适合只做总控鉴权、参数校验和调用领域服务。

## 已确认设计方向

- 任务创建、编辑、启停、手动执行与日志查询仅允许具备总控调度权限的用户。
- 采用独立受限 worker 执行数据库驱动的调度任务；任务执行在非 root 容器内，禁止 Docker Socket 与宿主机业务目录挂载。
- 用户确认需要秒级调度：Cron 使用六段格式 `秒 分 时 日 月 周`，worker 每秒扫描到期任务。
- 同一任务禁止重入；到期时若上一次仍在运行，则记录一次“跳过”执行日志。
- 用户确认执行记录模型与表名采用 `ScheduledTaskLog` / `scheduled_task_log`，替代较技术化的 `ScheduledTaskExecution` / `scheduled_task_execution`。
