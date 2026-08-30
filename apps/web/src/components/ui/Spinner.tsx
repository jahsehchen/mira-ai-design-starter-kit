interface SpinnerProps {
  size?: number;
  light?: boolean;
  className?: string;
}

/** 加载旋转环（装饰用途，不承载文字） */
export function Spinner({ size = 20, light = false, className = '' }: SpinnerProps) {
  return (
    <span
      className={`spinner${light ? ' light' : ''}${className ? ` ${className}` : ''}`}
      style={{ width: size, height: size }}
      role="status"
      aria-label="加载中"
    />
  );
}
