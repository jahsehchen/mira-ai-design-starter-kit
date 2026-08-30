import { useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { ERROR_CODES, STYLE_PRESETS, type StylePreset } from '@mira/contracts';
import { CooldownError, useGenerationStore } from '../../stores/generationStore';
import { useUiStore } from '../../stores/uiStore';
import { worksApi } from '../../api/endpoints';
import { ApiError } from '../../api/client';
import { FEATURES } from '../../config';
import { Button } from '../../components/ui/Button';
import { Chip } from '../../components/ui/Chip';
import { LoadingSteps } from '../../components/ui/LoadingSteps';
import { Input } from '../../components/ui/Input';
import { useCasesEnabled } from '../../hooks/useFeatures';
import styleLibrary from '../../data/style-library.json';
import caseLibrary from '../../data/cases.json';
import CaseImage from '../../components/case/CaseImage';
import './app-views.css';

const RING_CIRCUMFERENCE = 194.8;

/** 案例库每页渲染数量；自定义数据集变大时继续支持分页 */
const CASE_PAGE_SIZE = 24;
/** 描述输入框默认最大长度（沿用既有 500 限制；套用超长案例提示词时临时放宽） */
const PROMPT_MAX_DEFAULT = 500;

/** 「全部」分类的虚拟 key（对应 style-library.json 的 13 个分类之外） */
const ALL_CATEGORIES = '__all__';

/** 模板库分类（裁剪版字段） */
interface StyleCategory {
  id: string;
  value: string;
  title: string;
  cover: string;
  description: string;
}

/** 模板库模板（裁剪版字段，i18n 已归一为 zh） */
interface StyleTemplate {
  id: string;
  title: string;
  description: string;
  category: string;
  styles: string[];
  scenes: string[];
  useWhen: string;
  guidance: string[];
  pitfalls: string[];
  cover: string;
  exampleCases: number[];
}

/** 案例库案例（裁剪版字段，promptPreview 已剔除以减小 bundle） */
interface CaseItem {
  id: number;
  title: string;
  image: string;
  imageAlt?: string;
  prompt: string;
  category: string;
  styles: string[];
  scenes: string[];
  featured: boolean;
}

const TEMPLATE_CATEGORIES = styleLibrary.categories as unknown as StyleCategory[];
const TEMPLATES = styleLibrary.templates as unknown as StyleTemplate[];

/** 案例库：仓库自有演示案例与最小模板分类 */
const CASES = caseLibrary.cases as unknown as CaseItem[];
const CASE_CATEGORIES = caseLibrary.categories as unknown as string[];

/** 分类 value（英文）→ 中文标题，供卡片角标展示 */
function categoryTitleOf(value: string): string {
  return TEMPLATE_CATEGORIES.find((c) => c.value === value)?.title ?? value;
}

/**
 * 合成带模板 guidance 的生成 prompt：
 * 未选模板时原样返回（行为与现状完全一致）；选中后追加模板指引段落。
 */
function buildTemplatePrompt(userText: string, tpl: StyleTemplate | null): string {
  if (!tpl) return userText;
  const lines: string[] = [userText, `【按模板「${tpl.title}」生成】`];
  if (tpl.useWhen) lines.push(`- 适用场景：${tpl.useWhen}`);
  if (tpl.guidance.length > 0) {
    lines.push('- 版式要点：');
    for (const point of tpl.guidance) lines.push(`  - ${point}`);
  }
  return lines.join('\n');
}

/** 根据生成结果找到或创建对应作品，返回 workId */
async function resolveWorkId(
  generationId: string,
  title: string,
  subtitle: string,
  canvasJson: Record<string, unknown>,
): Promise<string> {
  const list = await worksApi.list({ page: 1, pageSize: 50 });
  const match = list.items.find((w) => w.sourceGenerationId === generationId);
  if (match) return match.id;
  const created = await worksApi.create({
    title,
    description: subtitle,
    canvasJson,
    width: 1080,
    height: 1350,
  });
  return created.id;
}

/**
 * V3 生成器：描述/风格/选项 → 三态 UI（loading 覆盖层 / 成功结果卡 / 失败重试）
 *
 * 生成限频：NVIDIA 免费层约 40 RPM，连续快速点击容易触发 429。
 * 前端在 generationStore 做 10s 冷却（两次生成最短间隔），冷却中按钮 disabled
 * 并显示剩余秒数；若后端仍返回 429，则临时把冷却拉长为 30s 并弹友好提示。
 * 详见 generationStore.ts 顶部注释。
 */
export default function GeneratorPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const showToast = useUiStore((s) => s.showToast);
  const openConfirm = useUiStore((s) => s.openConfirm);
  const casesEnabled = useCasesEnabled();

  const {
    phase,
    step,
    steps,
    result,
    error,
    cooldownRemainingSec,
    startGeneration,
    retry,
    reset,
    stopPolling,
  } = useGenerationStore();

  const inCooldown = cooldownRemainingSec > 0;

  const [prompt, setPrompt] = useState('');
  const [stylePreset, setStylePreset] = useState<StylePreset>('不限');
  const [count, setCount] = useState<1 | 2>(2);
  const [autoMatch, setAutoMatch] = useState(true);

  // 模板库选择器：分类筛选 + 选中模板（可空 = 不启用模板增强）
  const [catFilter, setCatFilter] = useState<string>(ALL_CATEGORIES);
  const [selectedTemplateId, setSelectedTemplateId] = useState<string | null>(null);

  // 案例库选择器：分类筛选 + 展开详情 + 分页
  const [caseCatFilter, setCaseCatFilter] = useState<string>(ALL_CATEGORIES);
  const [selectedCaseId, setSelectedCaseId] = useState<number | null>(null);
  const [caseVisibleCount, setCaseVisibleCount] = useState<number>(CASE_PAGE_SIZE);
  // 描述框最大长度：默认 500；套用超长案例提示词时临时放宽到该 prompt 的长度
  const [promptMaxLength, setPromptMaxLength] = useState<number>(PROMPT_MAX_DEFAULT);

  /** 当前分类下可见的模板（全部 or 按 category value 过滤） */
  const visibleTemplates =
    catFilter === ALL_CATEGORIES
      ? TEMPLATES
      : TEMPLATES.filter((t) => t.category === catFilter);

  /** 当前选中的模板对象（未选则为 null） */
  const selectedTemplate = TEMPLATES.find((t) => t.id === selectedTemplateId) ?? null;

  /** 点击卡片：选中/再点取消 */
  const toggleTemplate = (id: string) => {
    setSelectedTemplateId((prev) => (prev === id ? null : id));
  };

  /** 当前分类下可见的案例（全部 or 按 category value 过滤），useMemo 避免每次渲染重算 */
  const visibleCases = useMemo(
    () => (caseCatFilter === ALL_CATEGORIES ? CASES : CASES.filter((c) => c.category === caseCatFilter)),
    [caseCatFilter],
  );
  /** 分页切片：只渲染前 N 个 */
  const pagedCases = visibleCases.slice(0, caseVisibleCount);
  const hasMoreCases = caseVisibleCount < visibleCases.length;
  /** 当前展开详情的案例对象（未选则为 null） */
  const selectedCase = CASES.find((c) => c.id === selectedCaseId) ?? null;

  /** 切换案例分类：重置分页并关闭已展开的详情（只影响网格过滤） */
  const switchCaseCategory = (value: string) => {
    setCaseCatFilter(value);
    setCaseVisibleCount(CASE_PAGE_SIZE);
    setSelectedCaseId(null);
  };

  /** 加载更多案例（每次 +24） */
  const loadMoreCases = () => setCaseVisibleCount((prev) => prev + CASE_PAGE_SIZE);

  /**
   * 套用案例提示词：
   * 1) 完整 prompt 覆盖填入描述框（无论用户是否有输入）；
   * 2) 超长 prompt 临时放宽 maxLength（默认 500 保持不变，未套用时行为不变）；
   * 3) 自动选中该案例分类下的模板（存在匹配时），并把模板库切到对应分类。
   */
  const applyCasePrompt = (c: CaseItem) => {
    setPrompt(c.prompt);
    setPromptMaxLength(c.prompt.length > PROMPT_MAX_DEFAULT ? Math.ceil(c.prompt.length / 100) * 100 : PROMPT_MAX_DEFAULT);
    const matchedTpl = TEMPLATES.find((t) => t.category === c.category);
    if (matchedTpl) {
      setSelectedTemplateId(matchedTpl.id);
      setCatFilter(c.category);
    }
    showToast('已套用案例提示词', 'success');
  };

  // 从工作台/案例详情带入描述：优先 query（?prompt=，登录回跳后仍保留），兜底 location.state
  useEffect(() => {
    const q = new URLSearchParams(location.search);
    const fromQuery = q.get('prompt');
    const state = location.state as { prompt?: string } | null;
    const fromState = state?.prompt;
    if (fromQuery || fromState) {
      setPrompt(fromQuery ?? fromState ?? '');
    }
  }, [location.state, location.search]);

  // 卸载时停止轮询
  useEffect(() => () => stopPolling(), [stopPolling]);

  /** B4：额度耗尽升级引导（payments 开启 → 弹确认跳订阅页；关闭 → 仅提示） */
  const handleQuotaExceeded = async () => {
    if (FEATURES.payments) {
      const goUpgrade = await openConfirm({
        title: '本月生成额度已用完',
        description: '升级 Pro 可解锁更多生成次数',
        confirmText: '去升级',
      });
      if (goUpgrade) navigate('/app/subscribe');
    } else {
      showToast('本月生成额度已用完', 'warning');
    }
  };

  const handleGenerate = async () => {
    if (inCooldown) return; // 冷却中按钮已 disabled，这里仅兜底
    const value = prompt.trim();
    if (!value) {
      showToast('先输入一句描述吧', 'warning');
      return;
    }
    // 选中模板时把结构化 guidance 合进 prompt（未选模板时原样透传，行为不变）
    const finalPrompt = buildTemplatePrompt(value, selectedTemplate);
    console.log('[MIRA] 生成 prompt（含模板 guidance）:', finalPrompt);
    try {
      await startGeneration({
        prompt: finalPrompt,
        stylePreset,
        options: { count, autoMatch, simulateFailure: false },
      });
    } catch (err) {
      if (err instanceof CooldownError) return; // 冷却拦截，静默不打扰
      if (err instanceof ApiError && err.code === ERROR_CODES.QUOTA_EXCEEDED) {
        await handleQuotaExceeded();
        return;
      }
      showToast(err instanceof Error ? err.message : '生成失败，请稍后再试', 'error');
    }
  };

  const handleRegenerate = async () => {
    if (inCooldown) return; // 冷却中按钮已 disabled，这里仅兜底
    showToast('好的，基于同一描述重绘一版', 'info');
    try {
      await retry();
    } catch (err) {
      if (err instanceof CooldownError) return; // 冷却拦截，静默不打扰
      if (err instanceof ApiError && err.code === ERROR_CODES.QUOTA_EXCEEDED) {
        await handleQuotaExceeded();
        return;
      }
      showToast(err instanceof Error ? err.message : '生成失败，请稍后再试', 'error');
    }
  };

  const handleEdit = async () => {
    if (!result) return;
    try {
      const workId = await resolveWorkId(
        useGenerationStore.getState().generationId ?? '',
        result.title,
        result.subtitle,
        result.canvasJson,
      );
      navigate(`/app/editor/${workId}`);
    } catch {
      showToast('进入编辑器失败，请稍后再试', 'error');
    }
  };

  const handleExport = async () => {
    if (!result) return;
    try {
      const workId = await resolveWorkId(
        useGenerationStore.getState().generationId ?? '',
        result.title,
        result.subtitle,
        result.canvasJson,
      );
      navigate(`/app/export/${workId}`);
    } catch {
      showToast('进入导出失败，请稍后再试', 'error');
    }
  };

  return (
    <div className="fade-in">
      <div className="generator-wrap">
        <div className="gen-stage">
          <h1 className="gen-title">描述你的想法</h1>
          <p className="gen-sub">越具体，生成越贴近你想要的</p>
          <Input
            textarea
            placeholder="例如：咖啡店开业海报，暖色调，手绘风，标题「每日新鲜烘焙」"
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            maxLength={promptMaxLength}
            hint={`${prompt.length}/${promptMaxLength} · AI 将按描述生成`}
          />
          <div className="style-chips">
            {STYLE_PRESETS.map((style) => (
              <Chip key={style} active={stylePreset === style} onClick={() => setStylePreset(style)}>
                {style}
              </Chip>
            ))}
          </div>

          {/* 模板库选择器（选填）：分类筛选 → 模板卡片 → 选中摘要 */}
          <div className="tpl-picker">
            <div className="tpl-picker-head">
              <span className="tpl-picker-label">📐 模板库（选填）</span>
              <span className="tpl-picker-hint">套用专业版式指引，提升海报与排版质量</span>
            </div>
            <div className="tpl-cat-scroll" role="tablist" aria-label="模板分类筛选">
              <Chip
                active={catFilter === ALL_CATEGORIES}
                onClick={() => setCatFilter(ALL_CATEGORIES)}
              >
                全部
              </Chip>
              {TEMPLATE_CATEGORIES.map((cat) => (
                <Chip
                  key={cat.id}
                  active={catFilter === cat.value}
                  onClick={() => setCatFilter(cat.value)}
                >
                  {cat.title}
                </Chip>
              ))}
            </div>
            <div className="tpl-picker-grid">
              {visibleTemplates.map((tpl) => {
                const selected = selectedTemplateId === tpl.id;
                return (
                  <button
                    key={tpl.id}
                    type="button"
                    className={`tpl-pick-card${selected ? ' active' : ''}`}
                    aria-pressed={selected}
                    onClick={() => toggleTemplate(tpl.id)}
                  >
                    <span className="tpl-pick-title">{tpl.title}</span>
                    <span className="tpl-pick-desc">{tpl.description}</span>
                    <span className="tpl-pick-cat">{categoryTitleOf(tpl.category)}</span>
                  </button>
                );
              })}
            </div>
            {selectedTemplate && (
              <div className="tpl-selected-summary">
                <span className="tpl-selected-text">
                  已选：{selectedTemplate.title}
                  {selectedTemplate.guidance.length > 0 && (
                    <span className="tpl-selected-detail">
                      · 版式要点 {selectedTemplate.guidance.length} 条
                    </span>
                  )}
                </span>
                <button
                  type="button"
                  className="tpl-selected-cancel"
                  onClick={() => setSelectedTemplateId(null)}
                >
                  取消
                </button>
              </div>
            )}
          </div>

          {/* 案例库（选填）：分类筛选 → 图片网格（懒加载+分页）→ 点击展开详情 → 套用提示词（FEATURES.cases 关闭时隐藏） */}
          {casesEnabled && (
          <div className="case-picker">
            <div className="case-picker-head">
              <span className="case-picker-label">🖼 案例库（选填）</span>
              <span className="case-picker-hint">
                浏览 {CASES.length} 个仓库自有演示案例，点击卡片可套用提示词
              </span>
            </div>
            <div className="tpl-cat-scroll" role="tablist" aria-label="案例库分类筛选">
              <Chip
                active={caseCatFilter === ALL_CATEGORIES}
                onClick={() => switchCaseCategory(ALL_CATEGORIES)}
              >
                全部
              </Chip>
              {CASE_CATEGORIES.map((value) => (
                <Chip
                  key={value}
                  active={caseCatFilter === value}
                  onClick={() => switchCaseCategory(value)}
                >
                  {categoryTitleOf(value)}
                </Chip>
              ))}
            </div>

            {pagedCases.length === 0 ? (
              <div className="case-empty">该分类下暂无案例</div>
            ) : (
              <>
                <div className="case-grid">
                  {pagedCases.map((c) => {
                    const isOpen = selectedCaseId === c.id;
                    return (
                      <button
                        key={c.id}
                        type="button"
                        className={`case-card${isOpen ? ' active' : ''}`}
                        aria-expanded={isOpen}
                        onClick={() => setSelectedCaseId(isOpen ? null : c.id)}
                      >
                        <span className="case-card-img-wrap">
                          <CaseImage
                            caseItem={c}
                            className="case-card-img"
                            alt={c.imageAlt || c.title}
                            loading="lazy"
                          />
                        </span>
                        <span className="case-card-title">{c.title}</span>
                        <span className="case-card-src">仓库自有演示素材</span>
                      </button>
                    );
                  })}
                </div>
                {hasMoreCases && (
                  <button
                    type="button"
                    className="case-load-more"
                    onClick={loadMoreCases}
                  >
                    加载更多（已显示 {pagedCases.length}/{visibleCases.length}）
                  </button>
                )}
              </>
            )}

            {selectedCase && (
              <div className="case-detail">
                <div className="case-detail-head">
                  <span className="case-detail-title">{selectedCase.title}</span>
                  <button
                    type="button"
                    className="case-detail-close"
                    aria-label="关闭案例详情"
                    onClick={() => setSelectedCaseId(null)}
                  >
                    ×
                  </button>
                </div>
                <CaseImage
                  caseItem={selectedCase}
                  className="case-detail-img"
                  alt={selectedCase.imageAlt || selectedCase.title}
                  loading="eager"
                  preferHighRes
                />
                <div className="case-detail-prompt">{selectedCase.prompt}</div>
                <div className="case-detail-actions">
                  <Button size="sm" onClick={() => applyCasePrompt(selectedCase)}>
                    套用此提示词
                  </Button>
                  <span className="case-detail-link">仓库自有演示素材</span>
                </div>
              </div>
            )}
          </div>
          )}

          <div className="gen-btn-row">
            <Button size="lg" block onClick={handleGenerate} disabled={inCooldown}>
              ✨ 生成设计
            </Button>
            {inCooldown && (
              <p className="gen-cooldown-hint">生成太频繁，{cooldownRemainingSec}s 后再试</p>
            )}
          </div>
          <div className="gen-options">
            <label>
              <input
                type="checkbox"
                checked={count === 2}
                onChange={(e) => setCount(e.target.checked ? 2 : 1)}
              />
              同时生成 2 个备选
            </label>
            <label>
              <input type="checkbox" checked={autoMatch} onChange={(e) => setAutoMatch(e.target.checked)} />
              自动匹配字体配色
            </label>
          </div>
        </div>

        {/* 成功结果卡 */}
        {phase === 'success' && result && (
          <div className="gen-result">
            <div
              className="result-thumb"
              style={{
                background: `linear-gradient(160deg, ${result.gradient.from}, ${result.gradient.to})`,
              }}
            >
              {result.thumbnailUrl ? (
                <img src={result.thumbnailUrl} alt={result.title} />
              ) : (
                <div className="result-text">
                  <div className="r-title">{result.title}</div>
                  <div className="r-sub">{result.subtitle}</div>
                </div>
              )}
            </div>
            <div className="result-actions">
              <Button onClick={handleEdit}>继续编辑</Button>
              <Button variant="secondary" onClick={handleExport}>
                导出
              </Button>
              <Button variant="ghost" onClick={handleRegenerate} disabled={inCooldown}>
                🔄 AI 重绘
              </Button>
            </div>
          </div>
        )}

        {/* 失败态 */}
        {phase === 'error' && error && (
          <div className="gen-error">
            <p>{error.message}</p>
            <Button onClick={handleRegenerate} disabled={inCooldown}>重新生成</Button>
          </div>
        )}
      </div>

      {/* 生成中覆盖层 */}
      {phase === 'loading' && (
        <div className="gen-overlay">
          <div className="gen-panel">
            <div className="gen-ring">
              <svg width="72" height="72" viewBox="0 0 72 72">
                <circle className="track" cx="36" cy="36" r="31" strokeWidth="6" fill="none" />
                <circle
                  className="bar"
                  cx="36"
                  cy="36"
                  r="31"
                  strokeWidth="6"
                  fill="none"
                  strokeDasharray={RING_CIRCUMFERENCE}
                  strokeDashoffset={RING_CIRCUMFERENCE * (1 - Math.min(step, 3) / 3)}
                />
              </svg>
            </div>
            <div className="gen-state-title">
              {step >= 3 ? '设计完成！' : step >= 2 ? '正在生成设计…' : step >= 1 ? '正在匹配版式与配色…' : '正在理解你的描述…'}
            </div>
            <div className="gen-state-sub">
              {step >= 3 ? '你的作品已经准备好了' : '通常只需几秒钟'}
            </div>
            <LoadingSteps steps={steps} />
          </div>
        </div>
      )}
    </div>
  );
}
