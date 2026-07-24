# 总控系统设置重构计划

## 目标

- 移除总控后台“系统管理”下的“集成配置”菜单、路由与权限种子。
- 将“系统设置”完善为系统级配置中心，基于 `system_config` 键值表实现可扩展配置。
- 首批提供“允许上传的文件类型”等系统级配置项的查看与保存能力。

## 阶段

1. 盘点现有实现与差异
   - 确认总控菜单、路由、权限码、测试覆盖点。
   - 确认后端是否已有可复用配置模型或需新增领域模块。
2. 后端系统配置能力
   - 新增 `system_config` 模型、迁移、初始化约束。
   - 提供总控系统设置 API（查询、批量保存或按键保存）。
   - 增加配置项序列化、默认值与校验。
3. 前端系统设置页面
   - 移除总控“集成配置”入口。
   - 将“系统设置”替换为系统级配置表单。
   - 支持示例配置项展示、编辑、保存与说明文案。
4. 测试与验证
   - 补后端 API / 服务测试。
   - 更新前端菜单与页面测试。
   - 运行规定验证命令并清理临时文件。

## 验证

- `cd server; ..\\.venv\\Scripts\\python.exe -m pytest -q`
- `cd server; $env:DJANGO_SECRET_KEY='test-secret'; ..\\.venv\\Scripts\\python.exe manage.py makemigrations --check --dry-run`
- `cd web; yarn test -- --runInBand`
- `cd web; yarn build`
- `git status --short`
