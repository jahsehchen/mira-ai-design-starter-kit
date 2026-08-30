import * as Joi from 'joi';

/**
 * 环境变量校验（Joi schema），启动即校验缺失/非法变量。
 * 与 .env.example 保持一致。
 */
export const envValidationSchema = Joi.object({
  NODE_ENV: Joi.string().valid('development', 'production', 'test').default('development'),
  PORT: Joi.number().integer().min(1).max(65535).default(3000),
  SWAGGER_ENABLED: Joi.boolean().truthy('true').falsy('false').optional(),
  CORS_ORIGINS: Joi.string().allow('').optional(),

  DB_TYPE: Joi.string().valid('postgres', 'sqlite').default('postgres'),
  DB_HOST: Joi.string().optional(),
  DB_PORT: Joi.number().integer().optional(),
  DB_USER: Joi.string().optional(),
  DB_PASSWORD: Joi.string().optional(),
  DB_NAME: Joi.string().optional(),
  DB_SYNC: Joi.boolean().truthy('true').falsy('false').default(false),

  JWT_ACCESS_SECRET: Joi.string().min(8).default('change_me_access_secret'),
  JWT_REFRESH_SECRET: Joi.string().min(8).default('change_me_refresh_secret'),
  JWT_ACCESS_EXPIRES_IN: Joi.string().default('15m'),
  JWT_REFRESH_EXPIRES_IN: Joi.string().default('7d'),

  AI_PROVIDER: Joi.string().default('mock'),
  AI_MOCK_FAIL_RATE: Joi.number().min(0).max(1).default(0),

  // ---- Payments（Q8 支付系统框架）----
  PAYMENT_PROVIDER: Joi.string().valid('mock', 'wechat', 'alipay').default('mock'),
  PAYMENT_ORDER_EXPIRE_MINUTES: Joi.number().integer().min(1).default(15),
  PAYMENT_MOCK_TOKEN: Joi.string().optional(),
  PAYMENT_MOCK_PAY_URL_BASE: Joi.string().optional(),

  WECHAT_MCHID: Joi.string().allow('').optional(),
  WECHAT_APPID: Joi.string().allow('').optional(),
  WECHAT_API_V3_KEY: Joi.string().allow('').optional(),
  WECHAT_NOTIFY_URL: Joi.string().allow('').optional(),

  ALIPAY_APP_ID: Joi.string().allow('').optional(),
  ALIPAY_PRIVATE_KEY: Joi.string().allow('').optional(),
  ALIPAY_PUBLIC_KEY: Joi.string().allow('').optional(),
  ALIPAY_NOTIFY_URL: Joi.string().allow('').optional(),

  UPLOAD_DIR: Joi.string().default('./uploads'),
});
