import { LandingHeader } from '../../components/landing/LandingHeader';
import { LandingFooter } from '../../components/landing/LandingFooter';
import { CtaSection } from '../../components/landing/CtaSection';
import { FeatureBlock } from '../../components/landing';
import { SITE } from '../../config';
import '../../components/landing/landing.css';
import './landing-pages.css';

/** 功能页：5 个功能模块 + 对比表 + 最终 CTA */
export default function FeaturesPage() {
  return (
    <div className="landing-page">
      <LandingHeader active="features" />

      <main>
        <section className="hero">
          <div className="container">
            <span className="eyebrow">核心功能</span>
            <h1 className="hero-title">
              把复杂的设计，
              <br />
              变成一句话的事
            </h1>
            <p className="hero-sub">不用会软件，不用懂专业名词。下面这些能力，都是为「完全没学过设计」的人准备的。</p>
            <div className="hero-cta">
              <a className="btn btn-primary btn-lg" href="#/login">免费开始创作</a>
            </div>
            <p className="hero-note">免费版也能体验全部核心功能</p>
          </div>
        </section>

        <section className="section">
          <div className="container">
            {/* 1 描述生成 */}
            <FeatureBlock
              number="01 · 描述生成"
              title="把想法说出来，剩下的交给 AI"
              description={`你不用会排版、配色、选字体。只要用一句话描述你想要的效果，${SITE.name} 会理解你的意思，自动完成版式、配色和配图，一次给你几个方案。`}
              scene={{
                label: '谁在用 · 使用场景',
                text: (
                  <>
                    深夜想发朋友圈，不知道怎么配图 → 输入「<span className="quote">周末咖啡海报，暖色调，文艺一点</span>」，几秒钟就有成品。
                  </>
                ),
              }}
              ctaText="试试描述生成"
              ctaTo="/login"
              secondaryCta={{ text: '看生成案例', to: '/cases' }}
              visual={
                <>
                  <div className="mini-prompt">科技感海报 · 蓝色主调 <em>· 简洁大气</em></div>
                  <div className="mini-flow">
                    <span>AI 理解描述</span>
                    <span className="line"></span>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M5 12h14M13 6l6 6-6 6" />
                    </svg>
                  </div>
                  <div className="mini-grid cols3">
                    <div className="poster g-navy">
                      <span className="p-deco d1"></span>
                      <span className="p-tag">方案 1</span>
                      <div className="p-title">未来已来</div>
                      <div className="p-sub">FUTURE</div>
                    </div>
                    <div className="poster g-mist">
                      <span className="p-deco d1"></span>
                      <span className="p-tag">方案 2</span>
                      <div className="p-title">新视界</div>
                      <div className="p-sub">VISION</div>
                    </div>
                    <div className="poster g-blue">
                      <span className="p-deco d1"></span>
                      <span className="p-tag">方案 3</span>
                      <div className="p-title">启程</div>
                      <div className="p-sub">START</div>
                    </div>
                  </div>
                </>
              }
            />

            {/* 2 智能模板 */}
            <FeatureBlock
              reverse
              number="02 · 智能模板"
              title="海量模板，换个文字就是你的"
              description="模板按场景分好类：海报、朋友圈封面、小红书配图、商品促销、菜单价目表……挑一个顺眼的，换上你的文字和图片，马上就能用。"
              scene={{
                label: '谁在用 · 使用场景',
                text: (
                  <>
                    刚开店，商品图风格不统一 → 选一套「电商促销」模板，统一排版，上架前把每张图的文字换掉就行。
                  </>
                ),
              }}
              ctaText="逛逛模板库"
              ctaTo="/login"
              visual={
                <div className="mini-grid">
                  <div className="poster g-warm">
                    <span className="p-tag">社媒</span>
                    <div className="p-title">早餐打卡</div>
                    <div className="p-bars"><i></i><i></i></div>
                  </div>
                  <div className="poster g-deep">
                    <span className="p-tag">海报</span>
                    <div className="p-title">城市音乐节</div>
                    <div className="p-bars"><i></i><i></i></div>
                  </div>
                  <div className="poster g-mist">
                    <span className="p-tag">电商</span>
                    <div className="p-title">夏日好物</div>
                    <div className="p-bars"><i></i><i></i></div>
                  </div>
                  <div className="poster g-sand">
                    <span className="p-tag">品牌</span>
                    <div className="p-title">门店菜单</div>
                    <div className="p-bars"><i></i><i></i></div>
                  </div>
                </div>
              }
            />

            {/* 3 极简编辑器 */}
            <FeatureBlock
              number="03 · 极简编辑器"
              title="想改哪里，点哪里"
              description="界面干净到只有必要的东西：改个字、换个色、挪一下位置，点一点就完成。进阶功能先收起来，等你需要时再展开，不会被一堆按钮吓到。"
              scene={{
                label: '谁在用 · 使用场景',
                text: <>AI 生成的海报想改个标题 → 点进编辑器，双击文字直接改，颜色点一下就换好。</>,
              }}
              ctaText="打开编辑器"
              ctaTo="/login"
              visual={
                <div className="mini-editor">
                  <div className="mini-toolbar">
                    <span className="mini-tool on">文字</span>
                    <span className="mini-tool">图片</span>
                    <span className="mini-tool">颜色</span>
                    <span className="mini-tool">AI 调整</span>
                    <span className="mini-tool">导出</span>
                  </div>
                  <div className="mini-canvas">
                    <div className="poster g-warm">
                      <span className="p-deco d1"></span>
                      <div className="p-title">夏日冰饮</div>
                      <div className="p-sub">清凉一夏</div>
                    </div>
                  </div>
                  <div className="mini-props">
                    <span className="mini-swatch" style={{ background: '#2B4CFF' }}></span>
                    <span className="mini-swatch" style={{ background: '#0D0F12' }}></span>
                    <span className="mini-swatch" style={{ background: '#D9D4CC' }}></span>
                    <span className="mini-swatch" style={{ background: '#E5F4EC' }}></span>
                    <span className="more">更多属性 ›</span>
                  </div>
                </div>
              }
            />

            {/* 4 多尺寸导出 */}
            <FeatureBlock
              reverse
              number="04 · 多尺寸导出"
              title="一张图，一次导出全部尺寸"
              description="发朋友圈、发小红书、挂商品页、还要打印？不用每张尺寸都重新做。选好要的尺寸和格式，一次批量导出，直接拿去用。"
              scene={{
                label: '谁在用 · 使用场景',
                text: <>活动海报做好后 → 同时导出社媒 1:1、竖版 9:16、电商 800×800 和打印 A4，一次搞定所有平台。</>,
              }}
              ctaText="了解导出设置"
              ctaTo="/login"
              visual={
                <>
                  <div className="mini-size-row">
                    <div className="mini-size">
                      <div className="ratio r11"></div>
                      <b>社媒 1:1</b>
                      <span>1080×1080</span>
                    </div>
                    <div className="mini-size">
                      <div className="ratio r916"></div>
                      <b>竖版 9:16</b>
                      <span>1080×1920</span>
                    </div>
                    <div className="mini-size">
                      <div className="ratio r800"></div>
                      <b>电商</b>
                      <span>800×800</span>
                    </div>
                    <div className="mini-size">
                      <div className="ratio rA4"></div>
                      <b>打印 A4</b>
                      <span>210×297mm</span>
                    </div>
                  </div>
                  <div className="mini-batch">
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, color: 'var(--color-text-secondary)' }}>
                      <span>批量导出中…</span>
                      <span>4 张</span>
                    </div>
                    <div className="mini-bar"><i></i></div>
                  </div>
                </>
              }
            />

            {/* 5 AI 美化抠图 */}
            <FeatureBlock
              number="05 · AI 美化 / 抠图"
              title="照片不用重拍，AI 帮你处理"
              description="背景太乱、光线不好、想换个底色？AI 一键抠图，把主体单独拿出来，换背景、加装饰，都不用学复杂的操作。"
              scene={{
                label: '谁在用 · 使用场景',
                text: <>拍好的商品照片背景是家里客厅 → 一键抠图，换到干净的纯色背景上，马上能上架。</>,
              }}
              ctaText="免费体验抠图"
              ctaTo="/login"
              visual={
                <div className="mini-cut">
                  <div className="cut-img" style={{ background: 'linear-gradient(160deg,#6B6760,#23272B)' }}>
                    <span>原图 · 背景杂乱</span>
                  </div>
                  <div className="cut-arrow">
                    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M5 12h14M13 6l6 6-6 6" />
                    </svg>
                  </div>
                  <div className="cut-out" style={{ background: 'linear-gradient(160deg,#EEF1FF,#DDE3FF)' }}>
                    <div className="cut-subject"></div>
                  </div>
                </div>
              }
            />
          </div>
        </section>

        {/* 对比：传统工具 vs 本产品 */}
        <section className="section section-alt">
          <div className="container">
            <div className="section-head">
              <span className="section-tag">为什么不一样</span>
              <h2 className="h2">跟传统设计工具比，差别在哪</h2>
              <p className="lead">传统工具是为专业人士设计的；{SITE.name} 是为「想快速做出好看东西」的你设计的。</p>
            </div>
            <div className="cmp-wrap">
              <table className="cmp-table">
                <thead>
                  <tr>
                    <th style={{ width: '34%' }}></th>
                    <th className="mira-col">{SITE.companyName}</th>
                    <th>传统设计工具</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td>上手难度</td>
                    <td className="yes mira-col">打开就会，零基础可用</td>
                    <td className="no">要先学软件操作</td>
                  </tr>
                  <tr>
                    <td>排版配色</td>
                    <td className="yes mira-col">AI 自动完成，风格统一</td>
                    <td className="no">全靠自己经验试错</td>
                  </tr>
                  <tr>
                    <td>出图速度</td>
                    <td className="yes mira-col">一句话，几分钟出稿</td>
                    <td className="no">一张图做几小时</td>
                  </tr>
                  <tr>
                    <td>多尺寸适配</td>
                    <td className="yes mira-col">一次批量导出全部尺寸</td>
                    <td className="no">每张尺寸重新调整</td>
                  </tr>
                  <tr>
                    <td>费用</td>
                    <td className="yes mira-col">免费开始，用不着信用卡</td>
                    <td className="no">订阅贵，学习成本更高</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </section>

        <CtaSection
          title="别犹豫了，先做一张试试"
          description={`打开 ${SITE.name}，输入一句话。你会发现：做出好设计，原来这么简单。`}
          note="免费开始 · 无需信用卡 · 随时导出"
        />
      </main>

      <LandingFooter />
    </div>
  );
}
