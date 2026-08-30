# 配置说明

本地配置从 `.env.example` 开始；Compose 生产配置从 `.env.production.example` 开始。真实 `.env` 文件不会进入 Git。

## 核心配置

| 变量 | 本地默认 | 生产要求 |
|---|---|---|
| `NODE_ENV` | `development` | `production` |
| `PORT` | `3000` | API 容器内部端口 |
| `CORS_ORIGINS` | 本地 Web 地址 | 真实 HTTPS 来源，逗号分隔 |
| `SWAGGER_ENABLED` | `true` | 默认 `false` |
| `DB_TYPE` | `sqlite` | 推荐 `postgres` |
| `DB_SYNC` | `true` | 必须 `false`，使用迁移 |
| `JWT_ACCESS_SECRET` | 开发占位 | 至少 32 字符、随机且独立 |
| `JWT_REFRESH_SECRET` | 开发占位 | 至少 32 字符、随机且独立 |

生产模式还会拒绝过短或明显占位的 `DB_PASSWORD` 和 `PAYMENT_MOCK_TOKEN`。校验错误只列变量名，不输出密钥内容。

## AI

`AI_PROVIDER=mock` 不调用外部模型，适合开发和界面演示。使用 NVIDIA 适配层时设置：

```dotenv
AI_PROVIDER=nvidia
NVIDIA_API_KEY=your-own-key
AI_NVIDIA_MODEL=your-enabled-model
```

模型名称、配额和服务条款可能变化，应以提供商当前控制台和文档为准。不要把 API key 写入前端变量或提交记录。

## 支付

`PAYMENT_PROVIDER=mock` 只模拟站内流程，不会产生真实扣款。选择 `wechat` 或 `alipay` 时，生产校验要求相应商户字段和公网 HTTPS 回调地址；代码框架仍需要部署者根据当前平台规范完成联调、安全验签和合规审核。

## 上传文件

`UPLOAD_DIR` 默认为 `./uploads`。Compose 将其挂载到持久卷。公开部署建议改用受控对象存储，并增加文件类型、大小、病毒扫描、生命周期与访问权限策略。

## 前端

`VITE_API_BASE_URL=/api/v1` 适用于本地代理和默认 Nginx 反代。所有 `VITE_` 变量都会进入浏览器构建产物，绝不能放入秘密。
