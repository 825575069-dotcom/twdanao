# 调研记录

- `SettingsShell` 当前无加载属性，始终渲染导航与标题；`ControlSystemSettingsView` 将 `a-spin` 放在插槽中，导致加载图只在右侧内容区排布。
- `system_log.min_level` 当前定义在 `server/apps/platform/system_config.py` 的 `basic` 分组；分组数组只有基础、站点、上传。
- `SettingsShell` 当前共有四个调用方：总控系统设置、租户系统设置、个人中心、总控租户详情。
