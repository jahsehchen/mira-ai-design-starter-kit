interface SliderRowProps {
  label: string;
  min: number;
  max: number;
  step?: number;
  value: number;
  onChange: (value: number) => void;
  suffix?: string;
}

/** 滑杆行（字号/字间距/圆角/透明度），实时数值 */
export function SliderRow({ label, min, max, step = 1, value, onChange, suffix = '' }: SliderRowProps) {
  return (
    <div className="slider-row">
      <span>{label}</span>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
      />
      <span className="val">
        {value}
        {suffix}
      </span>
    </div>
  );
}
