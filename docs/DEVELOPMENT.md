# 开发指南

## 环境

- Node.js 20.17 或更高版本
- npm（仓库只维护 `package-lock.json`）
- 可选：Docker 与 Docker Compose

## 安装与运行

```bash
npm ci
cp .env.example .env
npm run dev
```

根目录是 npm workspaces。`apps/web`、`apps/api` 和 `packages/contracts` 共用一次安装；不要在子目录生成独立锁文件。

## 修改共享契约

前后端共享类型位于 `packages/contracts/src`。修改后运行：

```bash
npm run build:contracts
npm run typecheck
```

## 数据库

本地开发默认 SQLite 和 `DB_SYNC=true`。这仅用于快速启动。生产必须设为 `DB_SYNC=false`，通过受审查的迁移变更数据库结构。

## 案例与素材

演示案例在 `apps/web/src/data/cases.json`，素材只允许放入 `apps/web/public/images/demo/`。新增内容时：

1. 确认自己拥有再分发权；
2. 记录来源与许可证；
3. 不包含账号、个人数据或未授权商标素材；
4. 运行 `npm run qa:cases`。

## 提交前检查

```bash
npm run check
git diff --check
```

涉及配置或部署的修改还应使用明显的弱生产密钥运行一次启动，确认应用拒绝启动且不回显密钥。
