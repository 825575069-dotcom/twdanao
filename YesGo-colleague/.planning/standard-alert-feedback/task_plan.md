# 后台标准 Alert 改造计划

## 目标
将总控与租户后台的页面提示和操作反馈统一到 Ant Design Vue Alert 四级体系。

## 当前阶段
已完成

## 阶段
- [x] 阶段 1：四级类型、事件服务、Pinia Store
- [x] 阶段 2：StandardAlert 与 GlobalAlertRegion
- [x] 阶段 3：页面内 Alert 迁移
- [x] 阶段 4：message/HTTP 操作反馈迁移
- [x] 阶段 5：静态守卫、全量验证与提交

## 关键决策
- 页面内提示和短暂操作反馈全部统一为 Alert。
- HTTP 层使用无 Pinia 依赖的发布服务，避免 Axios 与 Vue 实例耦合。
- error 默认常驻，其余按规范自动关闭。

## 错误记录
| 错误 | 尝试 | 处理 |
|---|---:|---|
| `.active_plan` 预期值不符导致整批补丁拒绝 | 1 | 读取实际值 `control-rbac` 后重新应用，未产生半成品 |
| `corepack yarn test` 读取用户缓存目录时报 `EPERM` | 1 | 改用固定 Node 运行时执行仓库 `scripts/run-vitest.mjs` |
