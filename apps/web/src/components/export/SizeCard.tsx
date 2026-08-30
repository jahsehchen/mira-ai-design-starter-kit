import type { ExportPreset } from '@mira/contracts';

interface SizeCardProps {
  preset: ExportPreset;
  selected: boolean;
  onToggle: (preset: ExportPreset) => void;
}

/** 导出尺寸预设卡（多选） */
export function SizeCard({ preset, selected, onToggle }: SizeCardProps) {
  return (
    <button
      type="button"
      className={`size-card${selected ? ' active' : ''}`}
      aria-pressed={selected}
      onClick={() => onToggle(preset)}
    >
      <div className="ratio">{preset.key}</div>
      <div className="desc">
        {preset.label} · {preset.width}×{preset.height}
      </div>
    </button>
  );
}
