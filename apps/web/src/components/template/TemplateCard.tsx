import type { TemplateCategory, TemplateDto } from '@mira/contracts';
import { Button } from '../ui/Button';

const CATEGORY_LABELS: Record<TemplateCategory, string> = {
  poster: '海报',
  social: '社媒',
  ecommerce: '电商',
  brand: '品牌',
};

interface TemplateCardProps {
  template: TemplateDto;
  onApply?: (template: TemplateDto) => void;
}

/** 模板卡：渐变缩略图 + 一键套用（P2-02：统一样式、移动端常驻） */
export function TemplateCard({ template, onApply }: TemplateCardProps) {
  const background = `linear-gradient(160deg, ${template.gradientFrom}, ${template.gradientTo})`;

  return (
    <div className="tpl-card">
      <div className="tpl-thumb" style={{ background }}>
        {template.displayText}
      </div>
      <Button
        className="tpl-apply"
        size="sm"
        block
        onClick={(e) => {
          e.stopPropagation();
          onApply?.(template);
        }}
      >
        一键套用
      </Button>
      <div className="tpl-meta">
        <span className="name">{template.name}</span>
        <span className="cat">{CATEGORY_LABELS[template.category] ?? template.category}</span>
      </div>
    </div>
  );
}
