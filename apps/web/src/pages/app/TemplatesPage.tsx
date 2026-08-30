import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import type { TemplateCategory, TemplateDto } from '@mira/contracts';
import { templatesApi } from '../../api/endpoints';
import { useUiStore } from '../../stores/uiStore';
import { Chip } from '../../components/ui/Chip';
import { TemplateGrid } from '../../components/template/TemplateGrid';
import './app-views.css';

const CATEGORIES: { key: TemplateCategory | 'all'; label: string }[] = [
  { key: 'all', label: '全部' },
  { key: 'poster', label: '海报' },
  { key: 'social', label: '社媒' },
  { key: 'ecommerce', label: '电商' },
  { key: 'brand', label: '品牌' },
];

/** V2 模板库：搜索 + 分类 chips + 一键套用（调 /templates，P1-05 后端化） */
export default function TemplatesPage() {
  const navigate = useNavigate();
  const showToast = useUiStore((s) => s.showToast);

  const [category, setCategory] = useState<TemplateCategory | 'all'>('all');
  const [keyword, setKeyword] = useState('');
  const [templates, setTemplates] = useState<TemplateDto[]>([]);
  const [loading, setLoading] = useState(true);
  const searchTimer = useRef<number | null>(null);

  const fetchTemplates = useCallback(async (cat: TemplateCategory | 'all', kw: string) => {
    setLoading(true);
    try {
      const result = await templatesApi.list({ category: cat, keyword: kw, page: 1, pageSize: 50 });
      setTemplates(result.items);
    } catch {
      showToast('模板加载失败，请稍后再试', 'error');
    } finally {
      setLoading(false);
    }
  }, [showToast]);

  useEffect(() => {
    void fetchTemplates(category, keyword);
  }, [category, fetchTemplates]);

  // 输入防抖 300ms
  const handleSearch = (value: string) => {
    setKeyword(value);
    if (searchTimer.current) window.clearTimeout(searchTimer.current);
    searchTimer.current = window.setTimeout(() => {
      void fetchTemplates(category, value);
    }, 300);
  };

  const handleApply = async (template: TemplateDto) => {
    try {
      const work = await templatesApi.apply(template.id);
      showToast(`已套用「${template.name}」，去编辑器调整吧`, 'success');
      navigate(`/app/editor/${work.id}`);
    } catch {
      showToast('套用失败，请稍后再试', 'error');
    }
  };

  return (
    <div className="fade-in">
      <div className="view-head">
        <div>
          <h1>模板库</h1>
          <p>选一个喜欢的，一键套用，改改字就能用</p>
        </div>
      </div>

      <div className="tpl-search">
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
          <circle cx="7" cy="7" r="4.5" stroke="currentColor" strokeWidth="1.4" />
          <path d="M10.5 10.5L14 14" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
        </svg>
        <input
          type="text"
          placeholder="搜索模板…"
          value={keyword}
          onChange={(e) => handleSearch(e.target.value)}
        />
      </div>

      <div className="chips-row" style={{ marginBottom: 20 }}>
        {CATEGORIES.map((c) => (
          <Chip key={c.key} active={category === c.key} onClick={() => setCategory(c.key)}>
            {c.label}
          </Chip>
        ))}
      </div>

      <TemplateGrid templates={templates} loading={loading} onApply={handleApply} />

      {!loading && templates.length === 0 && (
        <div style={{ textAlign: 'center', padding: '48px 0', color: 'var(--color-text-tertiary)' }}>
          没有找到匹配的模板，换个关键词试试
        </div>
      )}
    </div>
  );
}
