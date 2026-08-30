import { Link, useNavigate } from 'react-router-dom';
import { useAuthStore } from '../../stores/authStore';
import { SITE } from '../../config';
import { useCasesEnabled } from '../../hooks/useFeatures';
import { LandingHeader } from '../../components/landing/LandingHeader';
import { LandingFooter } from '../../components/landing/LandingFooter';
import { CtaSection } from '../../components/landing/CtaSection';
import { CaseCard, FeatureCard } from '../../components/landing';
import { Button } from '../../components/ui/Button';
import CaseImage from '../../components/case/CaseImage';
import casesData from '../../data/cases.json';
import '../../components/landing/landing.css';
import './landing-pages.css';

/** cases.json 按 id 索引，供首页挑选仓库自有演示案例 */
const caseById = (id: number) => casesData.cases.find((c) => c.id === id) ?? casesData.cases[0];

/** 首页方案演示区：两张仓库自有案例图 */
const DEMO_CASES = [caseById(1), caseById(2)];

/** 案例精选：三张仓库自有演示图 */
const FEATURED_CASES = [
  { caseItem: caseById(1), title: '夜航音乐节海报', meta: '「活动主视觉」', tag: '活动海报' },
  { caseItem: caseById(2), title: '山野气泡水商品卡', meta: '「商品卖点卡」', tag: '电商主图' },
  { caseItem: caseById(3), title: '周末灵感社交卡', meta: '「社交内容卡」', tag: '社媒封面' },
];

/**
 * 首页（落地页 React 化，逐 Section 还原原型）
 */
export default function HomePage() {
  const navigate = useNavigate();
  const user = useAuthStore((s) => s.user);
  const casesEnabled = useCasesEnabled();

  const goStart = () => navigate(user ? '/app/dashboard' : '/login');

  return (
    <div className="landing-page">
      <LandingHeader active="home" />

      <main>
        {/* Hero */}
        <section className="hero">
          <div className="container">
            <span className="eyebrow">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 3l1.9 5.1L19 10l-5.1 1.9L12 17l-1.9-5.1L5 10l5.1-1.9L12 3z" />
              </svg>
              AI 视觉设计工具
            </span>
            <h1 className="hero-title">{SITE.tagline}</h1>
            <p className="hero-sub">
              让每个人都能把想法变成看得见的作品。不用学设计，不用懂排版——把你的想法说出来，剩下的交给 {SITE.name}。
            </p>
            <div className="hero-cta">
              <Button size="lg" onClick={goStart}>输入描述试试</Button>
              <Button variant="secondary" size="lg" onClick={() => navigate('/cases')}>看看大家的作品</Button>
            </div>
            <p className="hero-note">免费开始 · 无需信用卡 · 随时导出</p>

            {/* 描述 → 结果演示（仓库自有 SVG） */}
            <div className="hero-demo" aria-hidden="true">
              <div className="demo-panel">
                <div className="demo-input">
                  <span className="demo-prompt">科技感海报 · 蓝色主调 <em>· 简洁大气</em></span>
                  <span className="demo-btn">生成</span>
                </div>
                <div className="demo-arrow">
                  <span>AI 自动理解</span>
                  <span className="line"></span>
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M5 12h14M13 6l6 6-6 6" />
                  </svg>
                </div>
                <div className="demo-results">
                  {DEMO_CASES.map((c, i) => (
                    <div className="poster" key={c.image}>
                      <CaseImage caseItem={c} alt={c.title} className="poster-img" loading="lazy" />
                      <span className="p-tag">方案 {i + 1}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Social Proof */}
        <section className="trust" aria-label="用户与口碑">
          <div className="container">
            <p>从个人创作者到小团队，都在用它把想法变成作品</p>
            <div className="trust-row">
              <span>暖茶铺</span>
              <span>拾光工作室</span>
              <span>青禾咖啡</span>
              <span>山海文创</span>
              <span>木目摄影</span>
              <span>野山花艺</span>
            </div>
          </div>
        </section>

        {/* 3 核心功能 */}
        <section className="section">
          <div className="container">
            <div className="section-head">
              <span className="section-tag">核心能力</span>
              <h2 className="h2">设计这件事，其实很简单</h2>
              <p className="lead">三个步骤覆盖做图的全过程，每一步都不需要任何设计经验。</p>
            </div>
            <div className="feat-grid">
              <FeatureCard
                icon={
                  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M12 3l1.9 5.1L19 10l-5.1 1.9L12 17l-1.9-5.1L5 10l5.1-1.9L12 3z" />
                    <path d="M19 16l.8 2.2L22 19l-2.2.8L19 22l-.8-2.2L16 19l2.2-.8L19 16z" />
                  </svg>
                }
                title="说一句话就出稿"
                description="把想法用大白话说出来，AI 会理解你的描述，自动排版、配色、配图，一次给你几个方案挑。"
                linkText="了解描述生成"
                linkTo="/features"
              />
              <FeatureCard
                icon={
                  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="3" y="3" width="8" height="8" rx="2" />
                    <rect x="13" y="3" width="8" height="8" rx="2" />
                    <rect x="3" y="13" width="8" height="8" rx="2" />
                    <rect x="13" y="13" width="8" height="8" rx="2" />
                  </svg>
                }
                title="模板随便套"
                description="海量好看的现成模板，按场景分好类。挑一个喜欢的，换上你的文字和图片，马上就成。"
                linkText="了解智能模板"
                linkTo="/features"
              />
              <FeatureCard
                icon={
                  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M12 3v12M5 8l7-5 7 5" />
                    <path d="M4 20h16" />
                  </svg>
                }
                title="一次导出所有尺寸"
                description="一张图要发朋友圈、小红书、商品页、还要打印？一次导出全部尺寸，不用一张张重做。"
                linkText="了解多尺寸导出"
                linkTo="/features"
              />
            </div>
          </div>
        </section>

        {/* How It Works */}
        <section className="section section-alt">
          <div className="container">
            <div className="section-head">
              <span className="section-tag">三步上手</span>
              <h2 className="h2">从想法到成品，只要三步</h2>
              <p className="lead">不用教程，不用看说明书。打开就能做，第一次用也能出作品。</p>
            </div>
            <div className="steps">
              <div className="step">
                <div className="step-num">1</div>
                <h3>说一句话</h3>
                <p>写下你想要的设计，比如「夏日饮品海报，清爽一点」。</p>
              </div>
              <div className="step">
                <div className="step-num">2</div>
                <h3>挑一张喜欢的</h3>
                <p>AI 给你几个方案，选最合眼缘的，不满意就再生成一次。</p>
              </div>
              <div className="step">
                <div className="step-num">3</div>
                <h3>导出使用</h3>
                <p>选好尺寸和格式，保存下来，直接发到你的社交平台。</p>
              </div>
            </div>
          </div>
        </section>

        {/* 案例精选（FEATURES.cases 关闭时整区隐藏） */}
        {casesEnabled && (
          <section className="section">
            <div className="container">
              <div className="section-head">
                <span className="section-tag">案例精选</span>
                <h2 className="h2">大家的一句话作品</h2>
                <p className="lead">使用仓库自有演示素材展示海报、商品图和社媒封面的工作流。</p>
              </div>
              <div className="case-grid">
                {FEATURED_CASES.map((c) => (
                  <CaseCard key={c.caseItem.image} caseItem={c.caseItem} title={c.title} meta={c.meta} tag={c.tag} />
                ))}
              </div>
            </div>
          </section>
        )}

        {/* 定价入口 */}
        <section className="section-tight">
          <div className="container">
            <div className="price-strip">
              <div>
                <h3>免费开始，用不着信用卡</h3>
                <p>想先看看 Pro 和团队版？方案灵活，按需升级。</p>
              </div>
              <Link to="/pricing" className="btn btn-primary btn-lg">查看定价方案</Link>
            </div>
          </div>
        </section>

        {/* 最终 CTA */}
        <CtaSection
          title="你的第一张好设计，从一句话开始"
          description={`打开 ${SITE.name}，输入你的想法。几分钟后，你就能看到自己的作品。`}
          secondaryText="先看看功能"
          secondaryTo="/features"
        />
      </main>

      <LandingFooter />
    </div>
  );
}
