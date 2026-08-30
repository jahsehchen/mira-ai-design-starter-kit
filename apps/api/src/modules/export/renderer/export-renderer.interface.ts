import type { ExportFormat } from '@mira/contracts';
import type { WorkEntity } from '../../../database/entities/work.entity';

export interface ExportRenderOptions {
  work: WorkEntity;
  format: ExportFormat;
  width: number;
  height: number;
  outPath: string;
}

/** DI token：ExportQueueService 依赖此 token 获取渲染器实现 */
export const EXPORT_RENDERER_TOKEN = 'EXPORT_RENDERER_TOKEN';

/**
 * 导出渲染器抽象（P1-06 预留替换点）。
 * P0 用 PlaceholderRenderer（sharp/pdfkit 占位）；P1-06 可换 Canvas/Playwright 真实渲染，
 * 接口不变，仅替换 DI 实现。
 */
export interface ExportRenderer {
  render(options: ExportRenderOptions): Promise<{ byteSize: number }>;
}
