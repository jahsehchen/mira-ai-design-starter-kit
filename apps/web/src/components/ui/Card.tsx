import type { HTMLAttributes, ReactNode } from 'react';

interface CardProps extends HTMLAttributes<HTMLDivElement> {
  interactive?: boolean;
  children: ReactNode;
}

/** 卡片：白底 + hairline 边框 + 圆角 12px + 默认无投影；interactive 时 hover 升 Raised */
export function Card({ interactive = false, className = '', children, ...rest }: CardProps) {
  const classes = ['card', interactive ? 'card-interactive' : '', className].filter(Boolean).join(' ');
  return (
    <div className={classes} {...rest}>
      {children}
    </div>
  );
}
