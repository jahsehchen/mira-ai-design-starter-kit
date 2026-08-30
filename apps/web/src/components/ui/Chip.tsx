import type { ButtonHTMLAttributes, ReactNode } from 'react';

interface ChipProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  active?: boolean;
  children: ReactNode;
}

/** 筛选/风格 Chip：44px 触控目标，active 实底墨蓝 */
export function Chip({ active = false, className = '', children, ...rest }: ChipProps) {
  const classes = ['chip', active ? 'active' : '', className].filter(Boolean).join(' ');
  return (
    <button className={classes} aria-pressed={active} {...rest}>
      {children}
    </button>
  );
}
