import type { TemplateDto } from '@mira/contracts';
import { TemplateCard } from './TemplateCard';
import { Skeleton } from '../ui/Skeleton';

interface TemplateGridProps {
  templates: TemplateDto[];
  loading?: boolean;
  onApply?: (template: TemplateDto) => void;
}

/** 模板网格 + 骨架屏 */
export function TemplateGrid({ templates, loading = false, onApply }: TemplateGridProps) {
  if (loading) {
    return (
      <div className="tpl-grid">
        {Array.from({ length: 8 }).map((_, i) => (
          <Skeleton key={i} height={180} radius={12} />
        ))}
      </div>
    );
  }

  return (
    <div className="tpl-grid">
      {templates.map((template) => (
        <TemplateCard key={template.id} template={template} onApply={onApply} />
      ))}
    </div>
  );
}
