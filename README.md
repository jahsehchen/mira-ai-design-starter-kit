# MIRA·弥画

MIRA 是一个可自行部署的 AI 视觉设计网站框架。仓库包含 React 前端、NestJS API、共享 TypeScript 契约、SQLite/PostgreSQL 数据层、AI 提供商适配层，以及模拟支付流程。

> 这是开源起步框架，不是已经接入真实商户、生产数据库或商业 AI 配额的托管服务。默认 AI 和支付均为 mock；上线前必须配置自己的服务、密钥、域名、存储与合规流程。

## 开源边界

- 仓库只包含 3 组项目自有 SVG 演示素材与 3 条演示案例。
- 整理前源码包中的第三方社区案例图、账号信息、截图、日志、构建产物和内部交接材料均未纳入公开版本。
- 代码采用 MIT 许可证；你接入的模型、字体、图片、支付服务和其他第三方内容仍受各自条款约束。
- 演示数据与 mock 流程不代表真实交易、用户、客户案例或生产能力。

## 技术栈

- Web：React 18、Vite、TypeScript、Zustand
- API：NestJS 11、TypeORM、JWT、Swagger（生产默认关闭）
- 数据库：本地默认 SQLite；Compose 使用 PostgreSQL 16
- 工作区：npm workspaces，Node.js 20.17+

## 本地启动

```bash
npm ci
cp .env.example .env
npm run dev
```

Windows PowerShell 可用 `Copy-Item .env.example .env`。默认地址：

- Web：`http://localhost:5173`
- API：`http://localhost:3000/api/v1`
- Swagger（仅开发默认开启）：`http://localhost:3000/docs`

本地默认使用 SQLite、mock AI 和 mock 支付，不需要真实密钥。不要把 `.env` 提交到 Git。

## 常用命令

```bash
npm run dev             # 同时启动 Web 和 API
npm run typecheck       # TypeScript 静态检查
npm run build           # 构建全部工作区
npm run check           # 完整仓库检查
npm run qa:cases        # 校验自有案例及本地素材
npm run qa:security     # 验证生产弱密钥会被拒绝
```

## Docker Compose

```bash
cp .env.production.example .env.production
# 替换所有 CHANGE_ME 值，并把 CORS_ORIGINS 改为真实站点来源
docker compose --env-file .env.production up -d --build
```

Compose 只向主机公开 Web 端口；API 和 PostgreSQL 保留在内部网络。生产模式会拒绝占位或过短的数据库密码、JWT 密钥和 mock 支付 token。详见 [部署说明](docs/DEPLOYMENT.md)。

## 目录

```text
apps/web/                 React 前端
apps/api/                 NestJS API
packages/contracts/       前后端共享类型
scripts/                  静态检查与辅助脚本
e2e/                      端到端测试入口
docs/                     配置、开发和部署文档
```

## 文档

- [配置说明](docs/CONFIGURATION.md)
- [开发指南](docs/DEVELOPMENT.md)
- [部署说明](docs/DEPLOYMENT.md)
- [常见问题](docs/FAQ.md)
- [贡献指南](CONTRIBUTING.md)
- [安全策略](SECURITY.md)

## 许可证

代码以 [MIT License](LICENSE) 发布。项目名称和示例视觉不自动授予任何第三方商标或内容权利。
