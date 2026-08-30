import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  EXPORT_POLL_INTERVAL_MS,
  type ExportFormat,
  type ExportJobDto,
  type ExportPreset,
  type ExportSize,
} from '@mira/contracts';
import { exportApi, worksApi } from '../../api/endpoints';
import { useUiStore } from '../../stores/uiStore';
import { SITE } from '../../config';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { SizeCard } from '../../components/export/SizeCard';
import { FormatChips } from '../../components/export/FormatChips';
import { ProgressBar } from '../../components/export/ProgressBar';
import { downloadBlob, formatRelativeTime, safeFileName } from '../../utils/format';
import '../../pages/app/app-views.css';

interface BatchExportPanelProps {
  workIds: string[];
}

/** 今日日期戳（zip 文件名用）：YYYYMMDD */
function dateStamp(): string {
  const d = new Date();
  return `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}`;
}

/** 构造占位 job（批量创建响应后、首次轮询前展示用） */
function placeholderJob(
  id: string,
  workId: string,
  format: ExportFormat,
  sizes: ExportSize[],
): ExportJobDto {
  return {
    id,
    workId,
    format,
    sizes,
    status: 'pending',
    progress: 0,
    stageText: '等待处理',
    files: null,
    error: null,
    createdAt: new Date().toISOString(),
    finishedAt: null,
  };
}

/**
 * 批量导出面板（P1 R3）：
 * 统一尺寸/格式 → POST /export/batch-jobs（整批所有权校验）→ 逐 job 轮询真实进度 →
 * 聚合展示「已完成作品 x/y · 文件 m/n · p%」→ 逐一下载 / zip 打包（失败退逐一下载）→ 失败项单独重试。
 * 聚合公式全部来自后端真实字段，禁止伪造。
 */
export function BatchExportPanel({ workIds }: BatchExportPanelProps) {
  const navigate = useNavigate();
  const showToast = useUiStore((s) => s.showToast);

  const [works, setWorks] = useState<{ id: string; title: string }[]>([]);
  const [presets, setPresets] = useState<ExportPreset[]>([]);
  const [selectedKeys, setSelectedKeys] = useState<Set<string>>(new Set());
  const [format, setFormat] = useState<ExportFormat>('png');
  const [jobMap, setJobMap] = useState<Record<string, ExportJobDto>>({});
  const [starting, setStarting] = useState(false);
  const [zipping, setZipping] = useState(false);

  const jobIdsRef = useRef<string[]>([]);
  const jobMapRef = useRef<Record<string, ExportJobDto>>({});
  const pollTimerRef = useRef<number | null>(null);

  useEffect(() => {
    jobMapRef.current = jobMap;
  }, [jobMap]);

  // 加载作品标题 + 导出预设（默认前 2 个尺寸）
  useEffect(() => {
    void exportApi
      .presets()
      .then((p) => {
        setPresets(p);
        setSelectedKeys(new Set(p.slice(0, 2).map((x) => x.key)));
      })
      .catch(() => showToast('导出预设加载失败', 'error'));
  }, [showToast]);

  useEffect(() => {
    let cancelled = false;
    void Promise.all(
      workIds.map((id) =>
        worksApi
          .get(id)
          .then((w) => ({ id, title: w.title }))
          .catch(() => null),
      ),
    ).then((rows) => {
      if (cancelled) return;
      setWorks(rows.filter((r): r is { id: string; title: string } => r !== null));
    });
    return () => {
      cancelled = true;
    };
  }, [workIds]);

  const stopPolling = useCallback(() => {
    if (pollTimerRef.current !== null) {
      window.clearInterval(pollTimerRef.current);
      pollTimerRef.current = null;
    }
  }, []);

  useEffect(() => () => stopPolling(), [stopPolling]);

  /** 轮询所有 job 一次：更新 jobMap；全部终态（succeeded/failed）后停止 */
  const refreshJobs = useCallback(async () => {
    const ids = jobIdsRef.current;
    if (ids.length === 0) return;
    const next: Record<string, ExportJobDto> = { ...jobMapRef.current };
    let changed = false;
    for (const id of ids) {
      try {
        const data = await exportApi.getJob(id);
        next[id] = data;
        changed = true;
      } catch {
        // 单次轮询失败忽略
      }
    }
    if (changed) setJobMap(next);
    const allDone = ids.every((id) => {
      const j = next[id];
      return j && (j.status === 'succeeded' || j.status === 'failed');
    });
    if (allDone) stopPolling();
  }, [stopPolling]);

  const startPolling = useCallback(() => {
    stopPolling();
    pollTimerRef.current = window.setInterval(() => {
      void refreshJobs();
    }, EXPORT_POLL_INTERVAL_MS);
  }, [refreshJobs, stopPolling]);

  const toggleSize = (preset: ExportPreset) => {
    setSelectedKeys((prev) => {
      const next = new Set(prev);
      if (next.has(preset.key)) next.delete(preset.key);
      else next.add(preset.key);
      return next;
    });
  };

  const handleStart = async () => {
    if (workIds.length === 0) {
      showToast('请先选择要导出的作品', 'warning');
      return;
    }
    const sizes = presets.filter((p) => selectedKeys.has(p.key));
    if (sizes.length === 0) {
      showToast('请至少选择一个尺寸', 'warning');
      return;
    }
    setStarting(true);
    try {
      const { jobIds } = await exportApi.batchCreateJobs({
        workIds,
        format,
        sizes: sizes.map((s) => ({ key: s.key, width: s.width, height: s.height, label: s.label })),
      });
      jobIdsRef.current = jobIds;
      const initial: Record<string, ExportJobDto> = {};
      const sizeInputs: ExportSize[] = sizes.map((s) => ({
        key: s.key,
        width: s.width,
        height: s.height,
        label: s.label,
      }));
      jobIds.forEach((id, i) => {
        initial[id] = placeholderJob(id, workIds[i] ?? '', format, sizeInputs);
      });
      setJobMap(initial);
      showToast(`已创建 ${jobIds.length} 个导出任务，正在后台处理`, 'info');
      startPolling();
    } catch (err) {
      showToast(err instanceof Error ? err.message : '创建批量导出任务失败', 'error');
    } finally {
      setStarting(false);
    }
  };

  const handleDownload = async (jobId: string, fileId: string) => {
    try {
      const blob = await exportApi.downloadFile(jobId, fileId);
      downloadBlob(blob, safeFileName(fileId));
    } catch {
      showToast('下载失败，请稍后再试', 'error');
    }
  };

  const handleZip = async () => {
    const succeededIds = jobIdsRef.current.filter((id) => jobMapRef.current[id]?.status === 'succeeded');
    if (succeededIds.length === 0) {
      showToast('暂无可打包的已完成文件', 'warning');
      return;
    }
    setZipping(true);
    try {
      const blob = await exportApi.zipDownload({ jobIds: succeededIds });
      downloadBlob(blob, `${SITE.logoMark}画-批量导出-${dateStamp()}.zip`);
      showToast('打包下载已开始', 'success');
    } catch {
      // zip 失败兜底：保留逐一下载按钮（R3-4）
      showToast('打包下载失败，请使用逐一下载', 'error');
    } finally {
      setZipping(false);
    }
  };

  const retryJob = async (job: ExportJobDto) => {
    try {
      const { jobId } = await exportApi.createJob({
        workId: job.workId,
        format: job.format,
        sizes: job.sizes,
      });
      jobIdsRef.current = [...jobIdsRef.current, jobId];
      setJobMap((prev) => ({
        ...prev,
        [jobId]: placeholderJob(jobId, job.workId, job.format, job.sizes),
      }));
      if (pollTimerRef.current === null) startPolling();
      showToast('已重新入队，正在处理', 'info');
    } catch (err) {
      showToast(err instanceof Error ? err.message : '重试失败，请稍后再试', 'error');
    }
  };

  const jobs = useMemo(() => Object.values(jobMap), [jobMap]);

  // 聚合进度（全部来自后端真实字段，禁止伪造）
  const aggregate = useMemo(() => {
    const y = jobIdsRef.current.length;
    const x = jobs.filter((j) => j.status === 'succeeded').length;
    const m = jobs
      .filter((j) => j.status === 'succeeded')
      .reduce((s, j) => s + (j.files?.length ?? 0), 0);
    // 尺寸数以实际 job 配置为准（首个 job 的 sizes.length；尚未返回时用当前选择）
    const sizesPerJob = jobs[0]?.sizes.length ?? selectedKeys.size;
    const n = Math.max(0, jobIdsRef.current.length) * sizesPerJob;
    const p = jobs.length === 0 ? 0 : Math.round(jobs.reduce((s, j) => s + (j.progress ?? 0), 0) / jobs.length);
    return { x, y, m, n, p };
  }, [jobs, selectedKeys.size]);

  const failedCount = jobs.filter((j) => j.status === 'failed').length;
  const allDone = useMemo(() => {
    const ids = jobIdsRef.current;
    return (
      ids.length > 0 &&
      ids.every((id) => {
        const j = jobMap[id];
        return j && (j.status === 'succeeded' || j.status === 'failed');
      })
    );
  }, [jobMap]);

  const titleOf = (workId: string) => works.find((w) => w.id === workId)?.title ?? '作品';

  return (
    <div className="fade-in">
      <div className="view-head">
        <div>
          <h1>批量导出</h1>
          <p>已选 {workIds.length} 个作品 · 统一尺寸与格式，一次全部导出</p>
        </div>
        <Button variant="secondary" onClick={() => navigate('/app/gallery')}>
          返回作品库
        </Button>
      </div>

      <Card style={{ marginBottom: 16 }}>
        <h3 className="section-title">选择尺寸（{selectedKeys.size}/{presets.length}）</h3>
        <div className="size-grid">
          {presets.map((preset) => (
            <SizeCard
              key={preset.key}
              preset={preset}
              selected={selectedKeys.has(preset.key)}
              onToggle={toggleSize}
            />
          ))}
        </div>
      </Card>

      <Card>
        <h3 className="section-title">文件格式</h3>
        <FormatChips value={format} onChange={setFormat} />
        <div style={{ marginTop: 20 }}>
          <Button size="lg" block onClick={handleStart} loading={starting} disabled={jobIdsRef.current.length > 0 && !allDone}>
            开始批量导出（{workIds.length} 个作品 · {selectedKeys.size} 个尺寸）
          </Button>
        </div>
      </Card>

      {jobs.length > 0 && (
        <Card style={{ marginTop: 16 }}>
          <h3 className="section-title">批量进度</h3>
          <div className="batch-progress">
            <div className="batch-progress-main">
              已完成作品 {aggregate.x}/{aggregate.y} · 文件 {aggregate.m}/{aggregate.n} · {aggregate.p}%
            </div>
            <ProgressBar progress={aggregate.p} statusText="全部任务总进度" />
          </div>

          {allDone && (
            <div className="batch-summary">
              <span className="batch-summary-ok">成功 {aggregate.x}</span>
              {failedCount > 0 && <span className="batch-summary-fail">失败 {failedCount}</span>}
              <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                <Button size="sm" onClick={handleZip} loading={zipping}>
                  打包下载全部（zip）
                </Button>
              </div>
            </div>
          )}

          <div className="job-list" style={{ marginTop: 16 }}>
            {jobs.map((job) => {
              const title = titleOf(job.workId);
              return (
                <div className="job-item" key={job.id}>
                  <div className="job-main">
                    <div className="job-title">
                      {title} · {job.format.toUpperCase()} · {job.sizes.length} 个尺寸
                    </div>
                    <div className="job-meta">
                      {formatRelativeTime(job.createdAt)} ·{' '}
                      {job.status === 'succeeded'
                        ? '已完成'
                        : job.status === 'failed'
                          ? `失败：${job.error?.message ?? '导出失败'}`
                          : job.stageText}
                    </div>
                    {(job.status === 'processing' || job.status === 'pending') && (
                      <ProgressBar progress={job.progress} statusText={job.stageText} />
                    )}
                  </div>
                  {job.status === 'succeeded' && job.files && (
                    <div className="job-files">
                      {job.files.map((file) => (
                        <Button
                          key={file.fileId}
                          variant="secondary"
                          size="sm"
                          onClick={() => handleDownload(job.id, file.fileId)}
                        >
                          下载 {file.sizeKey}.{file.format}
                        </Button>
                      ))}
                    </div>
                  )}
                  {job.status === 'failed' && (
                    <Button variant="secondary" size="sm" onClick={() => retryJob(job)}>
                      重试
                    </Button>
                  )}
                </div>
              );
            })}
          </div>
        </Card>
      )}
    </div>
  );
}
