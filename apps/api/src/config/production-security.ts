import type { AppConfig } from './configuration';

const PLACEHOLDER_RE = /(change[_-]?me|placeholder|example|mira[_-]?secret|mira[_-]?mock)/i;

export function productionSecretError(name: string, value: string, minLength: number): string | null {
  if (!value || value.length < minLength || PLACEHOLDER_RE.test(value)) {
    return `${name} must be a non-placeholder value with at least ${minLength} characters`;
  }
  return null;
}

export function assertProductionSecret(name: string, value: string, minLength: number): void {
  if (process.env.NODE_ENV !== 'production') return;
  const error = productionSecretError(name, value, minLength);
  if (error) throw new Error(`[config] Unsafe production configuration: ${error}`);
}

export function validateProductionConfig(config: AppConfig): void {
  if (config.nodeEnv !== 'production') return;

  const errors = [
    productionSecretError('DB_PASSWORD', config.db.password, 16),
    productionSecretError('JWT_ACCESS_SECRET', config.jwt.accessSecret, 32),
    productionSecretError('JWT_REFRESH_SECRET', config.jwt.refreshSecret, 32),
  ];

  if (config.payments.provider === 'mock') {
    errors.push(productionSecretError('PAYMENT_MOCK_TOKEN', config.payments.mockToken, 16));
  }

  if (config.ai.provider === 'nvidia') {
    const key = config.ai.nvidia.apiKey;
    if (!key || !key.startsWith('nvapi-') || PLACEHOLDER_RE.test(key)) {
      errors.push('NVIDIA_API_KEY must be a non-placeholder nvapi- key when AI_PROVIDER=nvidia');
    }
  }

  if (config.payments.provider === 'wechat') {
    for (const [name, value] of Object.entries(config.payments.wechat)) {
      if (!value || PLACEHOLDER_RE.test(value)) errors.push(`WECHAT_${name.toUpperCase()} is required`);
    }
  }

  if (config.payments.provider === 'alipay') {
    for (const [name, value] of Object.entries(config.payments.alipay)) {
      if (!value || PLACEHOLDER_RE.test(value)) errors.push(`ALIPAY_${name.toUpperCase()} is required`);
    }
  }

  const actualErrors = errors.filter((item): item is string => Boolean(item));
  if (actualErrors.length > 0) {
    throw new Error(`[config] Unsafe production configuration: ${actualErrors.join('; ')}`);
  }
}
