# 修复容器缺失 api.shared.urls

## 目标

定位 Docker 中 Django 启动时 `api.shared.urls` 缺失的根因，做最小修复并用自动化检查验证。

## 阶段

- [x] 1. 收集堆栈、路由和 Docker 配置证据
- [x] 2. 对照正常源码与容器装载路径，确认根因
- [x] 3. 回归测试已完成 RED-GREEN，最小修复已实施
- [ ] 4. Django 验证已完成；Docker 实际构建受本机未安装 Docker CLI 阻塞

## 约束

- 保留用户已有未跟踪的 Docker 验证文件。
- 不修改无关的活动计划。

## 根因假设

`backend.Dockerfile` 与该仓库原有的 WSL2 部署方案不一致：它没有将 `server/` 写入镜像。因此任何未生效、滞后或被替换的运行时挂载都会使 `/app/server` 不含新加入的 `api/shared/urls.py`，进而在 Django 加载根路由时失败。
