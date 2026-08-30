import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useWorksStore } from '../../stores/worksStore';
import { useUiStore } from '../../stores/uiStore';
import { useAuthStore } from '../../stores/authStore';
import { SITE } from '../../config';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { WorkGrid } from '../../components/work/WorkGrid';
import { Skeleton } from '../../components/ui/Skeleton';
import './app-views.css';

const QUICK_PROMPTS = ['夏日促销海报', '小红书封面 3:4', '新品发布社媒图', '咖啡馆名片'];

/** V1 工作台：一句话开始 + 最近作品 + 新手三步走 */
export default function DashboardPage() {
  const navigate = useNavigate();
  const user = useAuthStore((s) => s.user);
  const { works, loading, fetchWorks } = useWorksStore();
  const showToast = useUiStore((s) => s.showToast);

  const [prompt, setPrompt] = useState('');

  useEffect(() => {
    void fetchWorks({ page: 1 }).catch(() => undefined);
  }, [fetchWorks]);

  const handleGenerate = () => {
    const value = prompt.trim();
    if (!value) {
      showToast('先输入一句描述，比如「科技感海报」', 'warning');
      return;
    }
    navigate('/app/generator', { state: { prompt: value } });
  };

  return (
    <div className="fade-in">
      {/* 一句话开始 */}
      <div className="start-card">
        <h2>今天想做点什么？</h2>
        <p>用一句话描述，剩下的交给 {SITE.name}</p>
        <div className="start-input-wrap">
          <input
            className="start-input"
            placeholder="例如：科技感海报，蓝色主调，标题「AI 发布会」"
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleGenerate()}
          />
          <div className="start-row">
            <Button size="lg" block onClick={handleGenerate}>
              生成设计
            </Button>
          </div>
        </div>
        <div className="quick-prompts">
          {QUICK_PROMPTS.map((q) => (
            <button key={q} className="quick-prompt" onClick={() => setPrompt(q)}>
              {q}
            </button>
          ))}
        </div>
      </div>

      <div className="dash-cols">
        <Card>
          <h3 className="section-title">最近作品</h3>
          {loading && works.length === 0 ? (
            <div className="work-grid">
              {Array.from({ length: 4 }).map((_, i) => (
                <Skeleton key={i} height={160} radius={12} />
              ))}
            </div>
          ) : works.length > 0 ? (
            <WorkGrid
              works={works.slice(0, 4)}
              onOpenWork={(work) => navigate(`/app/editor/${work.id}`)}
            />
          ) : (
            <p style={{ fontSize: 14, color: 'var(--color-text-tertiary)', padding: '12px 0' }}>
              还没有作品，输入一句话试试吧
            </p>
          )}
        </Card>

        <Card>
          <h3 className="section-title">新手三步走</h3>
          <ul className="checklist">
            <li>
              <span className="check-dot">✓</span>
              <span>完成你的第一张 AI 设计（生成 1 次）</span>
            </li>
            <li>
              <span className="check-dot">✓</span>
              <span>尝试一键换色，找到你的风格</span>
            </li>
            <li>
              <span className="check-dot pending">○</span>
              <span>导出多尺寸，发布到社交平台</span>
            </li>
          </ul>
          {user && (
            <Button variant="ghost" size="sm" onClick={() => navigate('/app/generator')} style={{ marginTop: 8 }}>
              去生成第一张设计 →
            </Button>
          )}
        </Card>
      </div>
    </div>
  );
}
