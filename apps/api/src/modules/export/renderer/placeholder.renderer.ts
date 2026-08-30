import { Injectable } from '@nestjs/common';
import { createWriteStream, existsSync, statSync } from 'node:fs';
import sharp from 'sharp';
import PDFDocument from 'pdfkit';
import type { ExportFormat } from '@mira/contracts';
import {
  ExportRenderer,
  ExportRenderOptions,
} from './export-renderer.interface';

function hexToRgb(hex: string): [number, number, number] {
  const value = (hex || '#2B4CFF').replace('#', '');
  return [
    parseInt(value.slice(0, 2) || '2B', 16),
    parseInt(value.slice(2, 4) || '4C', 16),
    parseInt(value.slice(4, 6) || 'FF', 16),
  ];
}

/**
 * P0 占位渲染器：生成真实格式文件（内容为占位渐变/纯色）。
 * - png/jpg：sharp 渐变图
 * - pdf：pdfkit 渐变页
 */
@Injectable()
export class PlaceholderRenderer implements ExportRenderer {
  async render(options: ExportRenderOptions): Promise<{ byteSize: number }> {
    const { work, format, width, height, outPath } = options;

    // 从作品画布提取渐变起点/终点色，无则用墨蓝占位
    const canvas = work.canvasJson as
      | { background?: { from?: string; to?: string } }
      | null
      | undefined;
    const from = canvas?.background?.from ?? '#2B4CFF';
    const to = canvas?.background?.to ?? '#9FADFF';

    if (format === 'pdf') {
      await this.renderPdf(from, to, width, height, outPath);
    } else {
      await this.renderRaster(from, to, width, height, format, outPath);
    }

    if (!existsSync(outPath)) {
      throw new Error(`渲染文件未生成: ${outPath}`);
    }
    return { byteSize: statSync(outPath).size };
  }

  private async renderRaster(
    from: string,
    to: string,
    width: number,
    height: number,
    format: 'png' | 'jpg',
    outPath: string,
  ): Promise<void> {
    const buffer = Buffer.alloc(width * height * 4);
    const [r1, g1, b1] = hexToRgb(from);
    const [r2, g2, b2] = hexToRgb(to);

    for (let y = 0; y < height; y += 1) {
      const t = y / (height - 1);
      const r = Math.round(r1 + (r2 - r1) * t);
      const g = Math.round(g1 + (g2 - g1) * t);
      const b = Math.round(b1 + (b2 - b1) * t);
      for (let x = 0; x < width; x += 1) {
        const i = (y * width + x) * 4;
        buffer[i] = r;
        buffer[i + 1] = g;
        buffer[i + 2] = b;
        buffer[i + 3] = 255;
      }
    }

    let pipeline = sharp(buffer, { raw: { width, height, channels: 4 } });
    if (format === 'jpg') {
      pipeline = pipeline.jpeg({ quality: 88 });
    } else {
      pipeline = pipeline.png();
    }
    await pipeline.toFile(outPath);
  }

  private async renderPdf(
    from: string,
    to: string,
    width: number,
    height: number,
    outPath: string,
  ): Promise<void> {
    const doc = new PDFDocument({ size: [width, height], margin: 0, autoFirstPage: true });
    const stream = createWriteStream(outPath);
    doc.pipe(stream);

    const gradient = doc.linearGradient(0, 0, 0, height);
    gradient.stop(0, from);
    gradient.stop(1, to);
    doc.rect(0, 0, width, height).fill(gradient);

    doc.end();
    await new Promise<void>((resolve, reject) => {
      stream.on('finish', () => resolve());
      stream.on('error', reject);
    });
  }
}
