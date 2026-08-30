# 部署说明

下面的 Compose 配置是可复现的起点，不代替云环境、安全或合规设计。

## 1. 准备配置

```bash
cp .env.production.example .env.production
```

替换所有 `CHANGE_ME` 值；为数据库、访问令牌、刷新令牌和 mock 回调分别生成独立随机值。把 `CORS_ORIGINS` 设为最终 HTTPS 站点来源。

## 2. 启动

```bash
docker compose --env-file .env.production up -d --build
docker compose --env-file .env.production ps
```

默认只公开 `WEB_PORT`（8080）。Nginx 将 `/api/` 与 `/uploads/` 转发到内部 API；数据库和 API 不映射主机端口。

## 3. 验证

- 打开 `http://localhost:8080` 或你的 HTTPS 域名。
- 验证登录、上传、生成和 mock 支付流程。
- 确认生产 `/docs` 默认不可访问。
- 检查容器日志中没有密钥、令牌、完整请求体或个人数据。

## 4. 上线前必做

- 在反向代理或负载均衡器终止 TLS，并设置安全响应头与请求大小限制。
- 将秘密放入部署平台的 secret manager，而不是仓库或镜像。
- 配置数据库备份、恢复演练和迁移回滚方案。
- 将上传迁移到受控存储，设置访问、保留和删除策略。
- 为真实 AI/支付提供商完成限额、重试、验签、合规和故障降级。
- 持续更新依赖与基础镜像，并接入日志脱敏、监控和告警。

## 更新与回滚

在预发布环境运行 `npm run check` 和数据库迁移演练。部署时保留上一镜像标签与数据库备份；代码回滚不能自动回滚数据库结构。
