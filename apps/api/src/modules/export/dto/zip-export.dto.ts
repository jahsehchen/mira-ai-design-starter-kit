import { ArrayMaxSize, ArrayMinSize, IsArray, IsUUID } from 'class-validator';

/**
 * zip 打包请求 DTO（P1 R3）：
 * jobIds 1..200（20 作品 × 10 尺寸上限）；仅打包 succeeded job 的文件，
 * 全部 job 必须属于当前用户，任一非本人 → 整批 403 拒绝。
 */
export class ZipExportDto {
  @IsArray({ message: '请选择要打包的导出任务' })
  @ArrayMinSize(1, { message: '请至少选择 1 个导出任务' })
  @ArrayMaxSize(200, { message: '一次最多打包 200 个导出任务' })
  @IsUUID('4', { each: true, message: 'jobId 无效' })
  jobIds!: string[];
}
