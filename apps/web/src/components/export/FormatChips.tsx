import type { ExportFormat } from '@mira/contracts';

const FORMATS: { key: ExportFormat; label: string }[] = [
  { key: 'png', label: 'PNG（推荐）' },
  { key: 'jpg', label: 'JPG' },
  { key: 'pdf', label: 'PDF' },
];

interface FormatChipsProps {
  value: ExportFormat;
  onChange: (format: ExportFormat) => void;
}

/** 导出格式切换（PNG/JPG/PDF） */
export function FormatChips({ value, onChange }: FormatChipsProps) {
  return (
    <div className="format-row" role="radiogroup" aria-label="文件格式">
      {FORMATS.map((format) => (
        <button
          key={format.key}
          type="button"
          role="radio"
          aria-checked={value === format.key}
          className={`format-chip${value === format.key ? ' active' : ''}`}
          onClick={() => onChange(format.key)}
        >
          {format.label}
        </button>
      ))}
    </div>
  );
}
