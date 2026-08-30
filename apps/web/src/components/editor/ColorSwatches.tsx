interface ColorSwatchesProps {
  colors: string[];
  active?: string;
  onSelect?: (color: string) => void;
}

/** 色板：点击换主题色（P2-01 联动标题色/强调元素） */
export function ColorSwatches({ colors, active, onSelect }: ColorSwatchesProps) {
  return (
    <div className="swatches">
      {colors.map((color) => (
        <button
          key={color}
          type="button"
          className={`swatch${active === color ? ' active' : ''}`}
          style={{ background: color }}
          aria-label={`选择颜色 ${color}`}
          onClick={() => onSelect?.(color)}
        />
      ))}
    </div>
  );
}
