import type { WorkDto } from '@mira/contracts';
import { WorkCard } from './WorkCard';
import { EmptyState } from '../ui/EmptyState';

interface WorkGridProps {
  works: WorkDto[];
  loading?: boolean;
  empty?: {
    icon: React.ReactNode;
    title: string;
    description: string;
    action?: React.ReactNode;
  };
  onOpenWork?: (work: WorkDto) => void;
  onDuplicateWork?: (work: WorkDto) => void;
  onShareWork?: (work: WorkDto) => void;
  onDeleteWork?: (work: WorkDto) => void;
  /** 选择模式（P1 R3 批量导出）：透传给每张卡 */
  selectable?: boolean;
  selectedIds?: Set<string>;
  onToggleSelect?: (id: string) => void;
}

/** 作品网格 + 空状态引导；选择模式下透传复选框 props */
export function WorkGrid({
  works,
  loading = false,
  empty,
  onOpenWork,
  onDuplicateWork,
  onShareWork,
  onDeleteWork,
  selectable = false,
  selectedIds,
  onToggleSelect,
}: WorkGridProps) {
  if (!loading && works.length === 0 && empty) {
    return <EmptyState icon={empty.icon} title={empty.title} description={empty.description} action={empty.action} />;
  }

  return (
    <div className="work-grid">
      {works.map((work) => (
        <WorkCard
          key={work.id}
          work={work}
          selectable={selectable}
          selected={selectedIds?.has(work.id) ?? false}
          onToggleSelect={() => onToggleSelect?.(work.id)}
          onOpen={() => onOpenWork?.(work)}
          onDuplicate={() => onDuplicateWork?.(work)}
          onShare={() => onShareWork?.(work)}
          onDelete={() => onDeleteWork?.(work)}
        />
      ))}
    </div>
  );
}
