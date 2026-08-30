import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { EXPORT_MAX_WORKS_PER_BATCH, type WorkDto } from '@mira/contracts';
import { useWorksStore } from '../../stores/worksStore';
import { useUiStore } from '../../stores/uiStore';
import { sharesApi } from '../../api/endpoints';
import { Button } from '../../components/ui/Button';
import { WorkGrid } from '../../components/work/WorkGrid';
import { EmptyState } from '../../components/ui/EmptyState';
import './app-views.css';

type SortKey = 'recent' | 'oldest';

/**
 * V5 作品管理（P1 R3 批量导出 + P2 R5 跨页全选）：
 * 顶部「选择」进入选择模式 → 卡片显示复选框、点击=切换选中、
 * 「全选」调 GET /works/matching-ids 一次选中当前筛选（keyword/sort）下全部匹配作品（跨页，≤20 截取并提示）、
 * 选中数实时显示「已选 N 个（全部 X 个中）」、底部批量操作条「批量导出（N）」→ 跳转 /app/export?workIds=。
 * 切换 sort/keyword 时清空已选并提示（避免跨条件误选，R5-5）；
 * 未进入选择模式时打开/复制/分享/删除行为不变（回归红线）。
 */
export default function GalleryPage() {
  const navigate = useNavigate();
  const { works, total, page, pageSize, loading, fetchWorks, fetchMatchingIds, removeWork, duplicateWork } =
    useWorksStore();
  const showToast = useUiStore((s) => s.showToast);
  const openConfirm = useUiStore((s) => s.openConfirm);

  const [sort, setSort] = useState<SortKey>('recent');
  // keyword 筛选当前无 UI（Q5 机制预留）：监听并随全选接口透传，未来上线即生效
  const [keyword, setKeyword] = useState('');
  const [selectMode, setSelectMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  /** R5 跨页全选缓存：最近一次全选返回的匹配 id（页面会话态，不入 store） */
  const [matchIds, setMatchIds] = useState<string[] | null>(null);
  /** R5 匹配总数（与列表接口 total 一致）；全选后用于「已选 N 个（全部 X 个中）」 */
  const [matchTotal, setMatchTotal] = useState<number | null>(null);
  const [selectAllLoading, setSelectAllLoading] = useState(false);

  useEffect(() => {
    void fetchWorks({ page: 1, sort, keyword }).catch(() => showToast('作品加载失败', 'error'));
  }, [fetchWorks, sort, keyword, showToast]);

  // 退出选择模式时清空选中（含跨页缓存）
  const exitSelectMode = useCallback(() => {
    setSelectMode(false);
    setSelectedIds(new Set());
    setMatchIds(null);
    setMatchTotal(null);
  }, []);

  // 最新选择态镜像：筛选变更 effect 读取最新值，避免闭包过期
  const selectModeRef = useRef(false);
  const hasSelectionRef = useRef(false);
  useEffect(() => {
    selectModeRef.current = selectMode;
    hasSelectionRef.current = selectedIds.size > 0;
  });

  // 筛选变更（sort/keyword）且选择模式有选中 → 清空已选 + toast（首渲染跳过，R5-5）
  const firstFilterRenderRef = useRef(true);
  useEffect(() => {
    if (firstFilterRenderRef.current) {
      firstFilterRenderRef.current = false;
      return;
    }
    if (selectModeRef.current && hasSelectionRef.current) {
      setSelectedIds(new Set());
      setMatchIds(null);
      setMatchTotal(null);
      showToast('筛选已变化，已清空所选作品', 'warning');
    }
  }, [sort, keyword, showToast]);

  const allSelected = useMemo(
    () => works.length > 0 && works.every((w) => selectedIds.has(w.id)),
    [works, selectedIds],
  );

  const toggleSelect = useCallback((id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  /**
   * R5 跨页全选：
   * - 当前已加载页全部选中 → 按钮显示「取消全选」，点击清空全部选中（含跨页部分，R5-3）
   * - 否则调 matching-ids 一次选中当前筛选下全部匹配作品（≤20，超限截取 + toast，R5-1/R5-2）
   */
  const handleSelectAll = useCallback(async () => {
    if (allSelected) {
      setSelectedIds(new Set());
      setMatchIds(null);
      setMatchTotal(null);
      return;
    }
    if (selectAllLoading) return;
    setSelectAllLoading(true);
    try {
      const { ids, total: matchedTotal } = await fetchMatchingIds({ sort, keyword });
      setSelectedIds(new Set(ids));
      setMatchIds(ids);
      setMatchTotal(matchedTotal);
      if (matchedTotal > EXPORT_MAX_WORKS_PER_BATCH) {
        showToast(
          `一次最多导出 ${EXPORT_MAX_WORKS_PER_BATCH} 个，已自动选中前 ${EXPORT_MAX_WORKS_PER_BATCH} 个（按当前排序）`,
          'warning',
        );
      }
    } catch {
      showToast('全选失败，请稍后再试', 'error');
    } finally {
      setSelectAllLoading(false);
    }
  }, [allSelected, selectAllLoading, fetchMatchingIds, sort, keyword, showToast]);

  const handleBatchExport = useCallback(() => {
    const count = selectedIds.size;
    if (count === 0) {
      showToast('请先勾选要导出的作品', 'warning');
      return;
    }
    // 防御性校验（跨页全选已截取 ≤20，正常不会超限；服务端仍纵深校验）
    if (count > EXPORT_MAX_WORKS_PER_BATCH) {
      showToast(`一次最多导出 ${EXPORT_MAX_WORKS_PER_BATCH} 个作品`, 'warning');
      return;
    }
    const ids = [...selectedIds].join(',');
    navigate(`/app/export?workIds=${encodeURIComponent(ids)}`);
  }, [selectedIds, navigate, showToast]);

  const handleDuplicate = useCallback(
    async (work: WorkDto) => {
      try {
        await duplicateWork(work.id);
        showToast('已复制一份副本', 'success');
      } catch {
        showToast('复制失败，请稍后再试', 'error');
      }
    },
    [duplicateWork, showToast],
  );

  const handleShare = useCallback(
    async (work: WorkDto) => {
      try {
        const share = await sharesApi.create({ workId: work.id });
        const url = `${window.location.origin}${share.url}`;
        await navigator.clipboard?.writeText(url).catch(() => undefined);
        showToast(`分享链接已复制：${url}`, 'success');
      } catch {
        showToast('分享失败，请稍后再试', 'error');
      }
    },
    [showToast],
  );

  const handleDelete = useCallback(
    async (work: WorkDto) => {
      const ok = await openConfirm({
        title: `删除「${work.title}」？`,
        description: '删除后无法恢复，作品将永久移除。',
        confirmText: '删除',
        danger: true,
      });
      if (!ok) return;
      try {
        await removeWork(work.id);
        // 若删除的是已选作品，同步移除选中
        setSelectedIds((prev) => {
          if (!prev.has(work.id)) return prev;
          const next = new Set(prev);
          next.delete(work.id);
          return next;
        });
        showToast('已删除', 'success');
      } catch {
        showToast('删除失败，请稍后再试', 'error');
      }
    },
    [openConfirm, removeWork, showToast],
  );

  const loadMore = async () => {
    if (loading || works.length >= total) return;
    try {
      await fetchWorks({ page: page + 1, sort, append: true });
    } catch {
      showToast('加载更多失败', 'error');
    }
  };

  const selectedCount = selectedIds.size;

  return (
    <div className="fade-in">
      <div className="view-head">
        <div>
          <h1>我的作品</h1>
          <p>你的每一份创作都自动保存在这里</p>
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          {selectMode ? (
            <>
              <Button variant="secondary" onClick={handleSelectAll} loading={selectAllLoading}>
                {allSelected ? '取消全选' : '全选'}
              </Button>
              <Button variant="secondary" onClick={exitSelectMode}>
                取消
              </Button>
            </>
          ) : (
            <>
              <Button variant="secondary" onClick={() => setSort((s) => (s === 'recent' ? 'oldest' : 'recent'))}>
                {sort === 'recent' ? '最近优先 ▾' : '最早优先 ▾'}
              </Button>
              <Button variant="secondary" onClick={() => setSelectMode(true)}>
                选择
              </Button>
            </>
          )}
        </div>
      </div>

      {selectMode && (
        <div className="select-hint">
          已选 <strong>{selectedCount} 个（全部 {matchTotal ?? total} 个中）</strong> · 点击卡片切换选中（一次最多{' '}
          {EXPORT_MAX_WORKS_PER_BATCH} 个）
        </div>
      )}

      <WorkGrid
        works={works}
        loading={loading && works.length === 0}
        selectable={selectMode}
        selectedIds={selectedIds}
        onToggleSelect={toggleSelect}
        onOpenWork={(work) => navigate(`/app/editor/${work.id}`)}
        onDuplicateWork={handleDuplicate}
        onShareWork={handleShare}
        onDeleteWork={handleDelete}
        empty={{
          icon: (
            <svg width="32" height="32" viewBox="0 0 32 32" fill="none">
              <rect x="4" y="4" width="24" height="24" rx="4" stroke="currentColor" strokeWidth="1.8" />
              <circle cx="11" cy="11" r="2.5" stroke="currentColor" strokeWidth="1.4" />
              <path d="M5.5 21.5l6.5-6.5 4.5 4.5 4-4 6 6" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
            </svg>
          ),
          title: '还没有作品',
          description: '用一句话，做出你的第一张设计',
          action: <Button onClick={() => navigate('/app/generator')}>输入描述试试</Button>,
        }}
      />

      {works.length > 0 && works.length < total && (
        <div className="pagination">
          <Button variant="secondary" onClick={loadMore} loading={loading}>
            加载更多（{works.length}/{total}）
          </Button>
        </div>
      )}

      {selectMode && (
        <div className="batch-bar">
          <span className="batch-bar-count">
            已选 {selectedCount} 个
            {matchTotal != null && <span className="sel-total">（全部 {matchTotal} 个中）</span>}
          </span>
          <Button onClick={handleBatchExport} disabled={selectedCount === 0}>
            批量导出（{selectedCount}）
          </Button>
        </div>
      )}
    </div>
  );
}
