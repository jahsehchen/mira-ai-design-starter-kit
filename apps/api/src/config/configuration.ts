import { validateProductionConfig } from './production-security';

/**
 * 全局配置：从环境变量读取，返回类型化配置对象。
 * 所有环境变量见根目录 .env.example。
 */
export interface AppConfig {
  nodeEnv: string;
  port: number;
  swaggerEnabled: boolean;
  corsOrigins: string[];
  db: {
    type: 'postgres' | 'sqlite';
    host: string;
    port: number;
    username: string;
    password: string;
    database: string;
    sync: boolean;
  };
  jwt: {
    accessSecret: string;
    refreshSecret: string;
    accessExpiresIn: string;
    refreshExpiresIn: string;
  };
  ai: {
    provider: string;
    mockFailRate: number;
    nvidia: {
      apiKey: string;
      model: string;
      baseUrl: string;
      /** 文本模型前置优化：中文 prompt → 英文图像描述（LLM 模型/端点） */
      llmModel: string;
      llmBaseUrl: string;
      /** 是否启用 prompt 优化（true 启用 / false 跳过直接用原 prompt） */
      promptEnhance: boolean;
    };
  };
  payments: {
    /** 支付渠道：mock（模拟）| wechat | alipay */
    provider: 'mock' | 'wechat' | 'alipay';
    /** 订单过期时间（分钟） */
    orderExpireMinutes: number;
    /** 模拟网关固定签名 token（mock 回调校验用） */
    mockToken: string;
    /** 站内模拟支付页地址 */
    mockPayUrlBase: string;
    wechat: {
      mchid: string;
      appid: string;
      apiV3Key: string;
      notifyUrl: string;
    };
    alipay: {
      appId: string;
      privateKey: string;
      alipayPublicKey: string;
      notifyUrl: string;
    };
  };
  uploadDir: string;
}

export default function configuration(): AppConfig {
  const nodeEnv = process.env.NODE_ENV || 'development';
  const config: AppConfig = {
    nodeEnv,
    port: parseInt(process.env.PORT || '3000', 10),
    swaggerEnabled: process.env.SWAGGER_ENABLED === 'true' || nodeEnv !== 'production',
    corsOrigins: (process.env.CORS_ORIGINS || 'http://localhost:5173,http://localhost:8080')
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean),
    db: {
      type: (process.env.DB_TYPE || 'postgres') === 'sqlite' ? 'sqlite' : 'postgres',
      host: process.env.DB_HOST || 'localhost',
      port: parseInt(process.env.DB_PORT || '5432', 10),
      username: process.env.DB_USER || 'mira',
      password: process.env.DB_PASSWORD || 'mira_secret_change_me',
      database: process.env.DB_NAME || 'mira',
      sync: process.env.DB_SYNC === 'true',
    },
    jwt: {
      accessSecret: process.env.JWT_ACCESS_SECRET || 'change_me_access_secret',
      refreshSecret: process.env.JWT_REFRESH_SECRET || 'change_me_refresh_secret',
      accessExpiresIn: process.env.JWT_ACCESS_EXPIRES_IN || '15m',
      refreshExpiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '7d',
    },
    ai: {
      provider: process.env.AI_PROVIDER || 'mock',
      mockFailRate: Math.min(1, Math.max(0, parseFloat(process.env.AI_MOCK_FAIL_RATE || '0') || 0)),
      nvidia: {
        apiKey: process.env.NVIDIA_API_KEY || '',
        model: process.env.AI_NVIDIA_MODEL || 'black-forest-labs/flux.1-dev',
        baseUrl: process.env.AI_NVIDIA_BASE_URL || 'https://ai.api.nvidia.com/v1/genai',
        llmModel: process.env.AI_NVIDIA_LLM_MODEL || 'deepseek-ai/deepseek-v4-flash-0731',
        llmBaseUrl: process.env.AI_NVIDIA_LLM_BASE_URL || 'https://integrate.api.nvidia.com/v1',
        // 仅显式配置 false 才关闭，默认开启
        promptEnhance: process.env.AI_NVIDIA_PROMPT_ENHANCE !== 'false',
      },
    },
    uploadDir: process.env.UPLOAD_DIR || './uploads',
    payments: {
      provider: (['mock', 'wechat', 'alipay'].includes(process.env.PAYMENT_PROVIDER || '')
        ? process.env.PAYMENT_PROVIDER
        : 'mock') as 'mock' | 'wechat' | 'alipay',
      orderExpireMinutes: parseInt(process.env.PAYMENT_ORDER_EXPIRE_MINUTES || '15', 10) || 15,
      mockToken: process.env.PAYMENT_MOCK_TOKEN || 'mira-mock-pay-token',
      mockPayUrlBase: process.env.PAYMENT_MOCK_PAY_URL_BASE || '/payments/mock-pay',
      wechat: {
        mchid: process.env.WECHAT_MCHID || '',
        appid: process.env.WECHAT_APPID || '',
        apiV3Key: process.env.WECHAT_API_V3_KEY || '',
        notifyUrl: process.env.WECHAT_NOTIFY_URL || '',
      },
      alipay: {
        appId: process.env.ALIPAY_APP_ID || '',
        privateKey: process.env.ALIPAY_PRIVATE_KEY || '',
        alipayPublicKey: process.env.ALIPAY_PUBLIC_KEY || '',
        notifyUrl: process.env.ALIPAY_NOTIFY_URL || '',
      },
    },
  };

  validateProductionConfig(config);
  warnMissingCredentials(config);
  return config;
}

/**
 * 缺凭据启动校验（Starter Kit：配置缺省即安全，仅 WARN 不崩溃）：
 * - AI_PROVIDER=nvidia 但无 NVIDIA_API_KEY → WARN，提示回退 mock
 * - PAYMENT_PROVIDER=wechat/alipay 缺必填凭据 → WARN，提示补齐或回退 mock
 */
function warnMissingCredentials(config: AppConfig): void {
  if (config.ai.provider === 'nvidia' && !config.ai.nvidia.apiKey) {
    console.warn(
      '[config] ⚠️ AI_PROVIDER=nvidia 但未配置 NVIDIA_API_KEY，AI 生成将失败。' +
        '建议改回 AI_PROVIDER=mock（零 Key 演示）或填入 nvapi- 开头的 Key。',
    );
  }
  if (config.payments.provider === 'wechat') {
    const missing = (['mchid', 'appid', 'apiV3Key', 'notifyUrl'] as const).filter(
      (k) => !config.payments.wechat[k],
    );
    if (missing.length > 0) {
      console.warn(
        `[config] ⚠️ PAYMENT_PROVIDER=wechat 缺少必填凭据：${missing.join(', ')}，支付下单将失败。` +
          '建议补齐（微信商户平台获取）或改回 PAYMENT_PROVIDER=mock。',
      );
    }
  }
  if (config.payments.provider === 'alipay') {
    const missing = (['appId', 'privateKey', 'alipayPublicKey', 'notifyUrl'] as const).filter(
      (k) => !config.payments.alipay[k],
    );
    if (missing.length > 0) {
      console.warn(
        `[config] ⚠️ PAYMENT_PROVIDER=alipay 缺少必填凭据：${missing.join(', ')}，支付下单将失败。` +
          '建议补齐（支付宝开放平台获取）或改回 PAYMENT_PROVIDER=mock。',
      );
    }
  }
}
