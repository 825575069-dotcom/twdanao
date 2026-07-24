# WSL2 Docker 容器验证计划

## 目标

在 WSL2 的 Docker 容器中依次完成后端 pytest、前端 Vitest 和前端构建，且不使用开发 MySQL 数据或向宿主工作区写入测试产物。

## 阶段

- [x] 1. 调研现有 Compose、镜像与测试命令
- [x] 2. 新增隔离验证 Compose 配置与顺序执行脚本
- [x] 3. 更新 WSL2 Docker 验证说明
- [x] 4. 在 WSL2 Docker 中执行完整验证并记录结果

## 约束

- 只新增验证配置、脚本与文档，不修改用户已有的未提交文件
- 后端验证不连接 MySQL、Redis 或开发网络
- 前端依赖与构建产物仅存在于临时 Docker volume
- 任一验证失败必须使统一入口以非零状态退出
