import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import {
  EXPORT_POLL_INTERVAL_MS,
  type ExportFormat,
  type ExportJobDto,
  type ExportPreset,
} from '@mira/contracts';
import { exportApi, worksApi } from '../../api/endpoints';
import { useUiStore } from '../../stores/uiStore';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { SizeCard } from '../../components/export/SizeCard';
import { FormatChips } from '../../components/export/FormatChips';
import { ProgressBar } from '../../components/export/ProgressBar';
import { BatchExportPanel } from '../../components/export/BatchExportPanel';
import { EmptyState } from '../../components/ui/EmptyState';
import { downloadBlob, formatRelativeTime, safeFileName } from '../../utils/format';
import './app-views.css';

/**
 * V6 导出（P1 R3 批量模式）：
 * query `workIds` 存在 → 渲染 BatchExportPanel（批量模式）；
 * 无 workIds → 原单作品模式（回归红线，代码路径不变）。
 */
export default function ExportPage() {
  const { workId: workIdParam } = useParams<{ workId: string }>();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const showToast = useUiStore((s) => s.showToast);

  // 批量模式：从 query 解析 workIds（逗号分隔）
  const batchWorkIds = useMemo(() => {
    const raw = searchParams.get('workIds');
    if (!raw) return null;
    const ids = raw
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
    return ids.length > 0 ? ids : null;
  }, [searchParams]);

  const [presets, setPresets] = useState<ExportPreset[]>([]);
  const [selectedKeys, setSelectedKeys] = useState<Set<string>>(new Set());
  const [format, setFormat] = useState<ExportFormat>('png');
  const [workId, setWorkId] = useState<string | null>(workIdParam ?? null);
  const [workTitle, setWorkTitle] = useState('');

  const [job, setJob] = useState<ExportJobDto | null>(null);
  const [jobs, setJobs] = useState<ExportJobDto[]>([]);
  const [starting, setStarting] = useState(false);
  const pollTimer = useRef<number | null>(null);

  useEffect(() => {
    void exportApi.presets().then((p) => {
      setPresets(p);
      setSelectedKeys(new Set(p.slice(0, 2).map((x) => x.key)));
    }).catch(() => showToast('导出预设加载失败', 'error'));
  }, [showToast]);

  // 加载指定作品标题
  useEffect(() => {
    if (!workId) return;
    worksApi.get(workId).then((w) => setWorkTitle(w.title)).catch(() => undefined);
  }, [workId]);

  const stopPolling = useCallback(() => {
    if (pollTimer.current !== null) {
      window.clearInterval(pollTimer.current);
      pollTimer.current = null;
    }
  }, []);

  useEffect(() => () => stopPolling(), [stopPolling]);

  const pollJob = useCallback(
    (jobId: string) => {
      stopPolling();
      pollTimer.current = window.setInterval(async () => {
        try {
          const data = await exportApi.getJob(jobId);
          setJob(data);
          if (data.status === 'succeeded' || data.status === 'failed') {
            stopPolling();
            if (data.status === 'succeeded') {
              showToast(`导出完成，共 ${data.files?.length ?? 0} 个文件`, 'success');
            } else {
              showToast(data.error?.message ?? '导出失败，请重试', 'error');
            }
            void refreshJobs();
          }
        } catch {
          // 单次轮询失败忽略
        }
      }, EXPORT_POLL_INTERVAL_MS);
    },
    [showToast, stopPolling],
  );

  const refreshJobs = useCallback(async () => {
    try {
      const list = await exportApi.listJobs({ page: 1, pageSize: 10 });
      setJobs(list.items);
    } catch {
      // 历史列表失败不打扰
    }
  }, []);

  useEffect(() => {
    void refreshJobs();
  }, [refreshJobs]);

  const toggleSize = (preset: ExportPreset) => {
    setSelectedKeys((prev) => {
      const next = new Set(prev);
      if (next.has(preset.key)) next.delete(preset.key);
      else next.add(preset.key);
      return next;
    });
  };

  const handleStart = async () => {
    if (!workId) {
      showToast('请先从作品库选择要导出的作品', 'warning');
      return;
    }
    const selectedSizes = presets.filter((p) => selectedKeys.has(p.key));
    if (selectedSizes.length === 0) {
      showToast('请至少选择一个尺寸', 'warning');
      return;
    }
    setStarting(true);
    try {
      const { jobId } = await exportApi.createJob({
        workId,
        format,
        sizes: selectedSizes.map((s) => ({ key: s.key, width: s.width, height: s.height, label: s.label })),
      });
      setJob(null);
      showToast('导出任务已创建，正在后台处理', 'info');
      pollJob(jobId);
    } catch (err) {
      showToast(err instanceof Error ? err.message : '创建导出任务失败', 'error');
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

  // 批量模式（P1 R3）：query workIds 存在 → 渲染批量导出面板（hooks 已全部执行完毕）
  if (batchWorkIds) {
    return <BatchExportPanel workIds={batchWorkIds} />;
  }

  if (!workId) {
    return (
      <EmptyState
        icon={
          <svg width="32" height="32" viewBox="0 0 32 32" fill="none">
            <path d="M16 20V5M10.5 10.5L16 5l5.5 5.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
            <path d="M5 21v2.5A3.5 3.5 0 008.5 27h15a3.5 3.5 0 003.5-3.5V21" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
          </svg>
        }
        title="选择要导出的作品"
        description="在「我的作品」里挑一张，导出前还能再调整尺寸和格式"
        action={<Button onClick={() => navigate('/app/gallery')}>去作品库选择</Button>}
      />
    );
  }

  const selectedSizes = presets.filter((p) => selectedKeys.has(p.key));

  return (
    <div className="fade-in">
      <div className="view-head">
        <div>
          <h1>导出作品</h1>
          <p>{workTitle ? `正在导出：${workTitle}` : '选好尺寸和格式，一键导出全部'}</p>
        </div>
        <Button variant="secondary" onClick={() => navigate('/app/gallery')}>
          换个作品
        </Button>
      </div>

      <Card style={{ marginBottom: 16 }}>
        <h3 className="section-title">选择尺寸</h3>
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
          <Button size="lg" block onClick={handleStart} loading={starting}>
            开始导出（{selectedSizes.length} 个尺寸）
          </Button>
        </div>

        {job && (job.status === 'processing' || job.status === 'pending') && (
          <ProgressBar progress={job.progress} statusText={job.stageText} />
        )}

        {job && job.status === 'succeeded' && job.files && (
          <div style={{ marginTop: 16 }}>
            <div className="job-files">
              {job.files.map((file) => (
                <Button key={file.fileId} variant="secondary" size="sm" onClick={() => handleDownload(job.id, file.fileId)}>
                  下载 {file.sizeKey}.{file.format}（{(file.byteSize / 1024).toFixed(0)}KB）
                </Button>
              ))}
            </div>
          </div>
        )}
      </Card>

      {jobs.length > 0 && (
        <div style={{ marginTop: 24 }}>
          <h3 className="section-title">导出记录</h3>
          <div className="job-list">
            {jobs.map((item) => (
              <div className="job-item" key={item.id}>
                <div className="job-main">
                  <div className="job-title">
                    {item.format.toUpperCase()} · {item.sizes.length} 个尺寸
                  </div>
                  <div className="job-meta">
                    {formatRelativeTime(item.createdAt)} · {item.status === 'succeeded' ? '已完成' : item.status === 'failed' ? '失败' : item.stageText}
                  </div>
                </div>
                {item.status === 'succeeded' && item.files && (
                  <div className="job-files">
                    {item.files.map((file) => (
                      <Button key={file.fileId} variant="ghost" size="sm" onClick={() => handleDownload(item.id, file.fileId)}>
                        下载 {file.sizeKey}
                      </Button>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
