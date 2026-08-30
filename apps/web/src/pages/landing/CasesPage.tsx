import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { LandingHeader } from '../../components/landing/LandingHeader';
import { LandingFooter } from '../../components/landing/LandingFooter';
import { CtaSection } from '../../components/landing/CtaSection';
import { Chip } from '../../components/ui/Chip';
import { Button } from '../../components/ui/Button';
import { SITE } from '../../config';
import { useCasesEnabled } from '../../hooks/useFeatures';
import { FeatureOff } from '../../components/ui/FeatureOff';
import CaseImage from '../../components/case/CaseImage';
import casesData from '../../data/cases.json';
import '../../components/landing/landing.css';
import './landing-pages.css';

type CaseCategory = 'all' | 'poster' | 'social' | 'ecommerce' | 'brand';

interface CaseItem {
  /** cases.json 仓库自有演示案例对象 */
  caseItem: { image: string; title?: string; prompt?: string };
  title: string;
  cat: CaseCategory;
  tag: string;
  prompt: string;
}

const FILTER_META: Record<string, { cat: Exclude<CaseCategory, 'all'>; tag: string }> = {
  'Posters & Typography': { cat: 'poster', tag: '海报' },
  'Products & E-commerce': { cat: 'ecommerce', tag: '电商' },
  'UI & Interfaces': { cat: 'social', tag: '社媒' },
};

/** 案例页：3 个仓库自有演示案例 */
const CASES: CaseItem[] = casesData.cases.map((item) => ({
  caseItem: item,
  title: item.title,
  cat: FILTER_META[item.category]?.cat ?? 'brand',
  tag: FILTER_META[item.category]?.tag ?? '品牌',
  prompt: item.prompt,
}));

const FILTERS: { key: CaseCategory; label: string }[] = [
  { key: 'all', label: '全部' },
  { key: 'poster', label: '海报' },
  { key: 'social', label: '社媒' },
  { key: 'ecommerce', label: '电商' },
  { key: 'brand', label: '品牌' },
];

/** 案例页：筛选 chips + 自有演示案例网格 + 描述→结果演示 + 最终 CTA */
export default function CasesPage() {
  const navigate = useNavigate();
  const casesEnabled = useCasesEnabled();
  const [filter, setFilter] = useState<CaseCategory>('all');
  const [selected, setSelected] = useState<CaseItem | null>(null);

  const visible = CASES.filter((c) => filter === 'all' || c.cat === filter);

  // Esc 关闭详情弹窗
  useEffect(() => {
    if (!selected) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setSelected(null);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [selected]);

  /** 套用该案例提示词 → 跳转生成页（query 传 prompt，登录回跳后仍保留） */
  const handleUsePrompt = () => {
    if (!selected) return;
    navigate(`/app/generator?prompt=${encodeURIComponent(selected.prompt)}`);
  };

  return (
    <div className="landing-page">
      <LandingHeader active="cases" />

      <main>
        {casesEnabled ? (
          <>
            <section className="page-hero">
              <div className="container">
                <span className="eyebrow">演示案例</span>
                <h1>从三个本地案例了解工作流</h1>
                <p>这些 SVG 由本仓库维护，用于展示海报、社媒图和商品图的框架能力。</p>
                <div className="filter-bar">
                  {FILTERS.map((f) => (
                    <Chip key={f.key} active={filter === f.key} onClick={() => setFilter(f.key)}>
                      {f.label}
                    </Chip>
                  ))}
                </div>
              </div>
            </section>

        <section className="container">
          <div className="case-grid-lite">
            {visible.map((c) => (
              <div
                className="case-card-lite"
                key={c.caseItem.image}
                role="button"
                tabIndex={0}
                onClick={() => setSelected(c)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    setSelected(c);
                  }
                }}
              >
                <div className="case-thumb-lite">
                  <CaseImage caseItem={c.caseItem} alt={c.title} className="case-thumb-lite-img" loading="lazy" />
                </div>
                <div className="case-info">
                  <div className="case-tags">
                    <span className="tag">{c.tag}</span>
                  </div>
                  <h3>{c.title}</h3>
                  <div className="case-detail">
                    <span className="prompt">💬 {c.prompt}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* 案例详情弹窗 */}
        {selected && (
          <div className="case-modal-overlay" role="dialog" aria-modal="true" onClick={() => setSelected(null)}>
            <div className="case-modal-panel" onClick={(e) => e.stopPropagation()}>
              <button className="case-modal-close" aria-label="关闭" onClick={() => setSelected(null)}>
                ✕
              </button>
              <div className="case-modal-img">
                <CaseImage caseItem={selected.caseItem} alt={selected.title} className="case-modal-img-el" preferHighRes loading="eager" />
              </div>
              <div className="case-modal-info">
                <div className="case-tags">
                  <span className="tag">{selected.tag}</span>
                </div>
                <h2>{selected.title}</h2>
                <p className="case-modal-prompt">💬 {selected.prompt}</p>
                <Button block onClick={handleUsePrompt}>用这句话生成</Button>
                <p className="case-modal-hint">将跳转到生成页并自动填入该提示词</p>
              </div>
            </div>
          </div>
        )}

        {/* 描述 → 结果 演示 */}
        <section className="demo-section">
          <div className="container">
            <div className="demo-wrap">
              <div>
                <span className="eyebrow">一步出图</span>
                <h2 className="h2-serif" style={{ textAlign: 'left', marginTop: 16 }}>
                  输入一句话，
                  <br />
                  得到一张好设计
                </h2>
                <p style={{ color: 'var(--color-text-secondary)', margin: '16px 0 24px' }}>
                  不用会排版、不用懂配色。你把想法说清楚，剩下的交给 {SITE.name}。
                </p>
                <a className="btn btn-primary btn-lg" href="#/login">输入描述试试</a>
              </div>
              <div className="demo-wrap" style={{ gridTemplateColumns: '1fr auto 1fr', gap: 16, alignItems: 'stretch' }}>
                <div className="demo-box">
                  <div className="label">你输入</div>
                  <p className="demo-prompt">夏日柠檬茶促销海报，清新黄绿配色，主标题「冰爽一夏」，底部加活动二维码</p>
                </div>
                <div className="arrow">→</div>
                <div className="demo-box">
                  <div className="label">{SITE.name} 生成</div>
                  <div className="demo-result" style={{ background: 'linear-gradient(135deg,#F7D774 0%,#F5B84B 45%,#7CC576 100%)' }}>
                    <span className="meta">一张可直接发布的促销海报</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>
          </>
        ) : (
          <FeatureOff
            title="案例库已关闭"
            description="当前站点未开放案例库，去创作区输入一句话试试吧。"
          />
        )}

        <CtaSection
          title="下一个作品，就是你的"
          description="免费开始，几分钟做出第一张设计。"
          primaryText="免费开始创作"
          secondaryText="查看定价"
          secondaryTo="/pricing"
          note="无需信用卡 · 随时导出"
        />
      </main>

      <LandingFooter />
    </div>
  );
}
