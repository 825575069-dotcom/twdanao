# 发现记录

- `web/src/views/common/AccountSettingsPage.vue` 同时服务总控与租户后台，修改该页面即可覆盖两个入口。
- 个人中心与系统设置已经共用 `SettingsShell` 和 `StandardEditForm`。
- 当前主要差异是个人中心基础设置存在 `.profile-summary-hero` 渐变头像卡片；系统设置使用统一的字段行、帮助文字、固定宽度控件与底部保存区。
- 系统设置的可复用视觉基准为：字段行 `22px` 间距、控件最大宽度 `360px`、说明文字 `13px / 20px`、保存区顶部间距 `6px`。
