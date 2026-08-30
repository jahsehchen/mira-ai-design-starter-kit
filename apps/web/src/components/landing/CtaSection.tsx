import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../../stores/authStore';
import { Button } from '../ui/Button';
import './landing.css';

interface CtaSectionProps {
  title: string;
  description: string;
  primaryText?: string;
  secondaryText?: string;
  secondaryTo?: string;
  note?: string;
}

/** 最终 CTA 区块 + 移动端底部 sticky CTA（滚动后出现） */
export function CtaSection({
  title,
  description,
  primaryText = '输入描述试试',
  secondaryText,
  secondaryTo,
  note = '免费开始 · 无需信用卡 · 随时导出',
}: CtaSectionProps) {
  const navigate = useNavigate();
  const user = useAuthStore((s) => s.user);
  const [showBar, setShowBar] = useState(false);

  useEffect(() => {
    let show = false;
    const onScroll = () => {
      const shouldShow = window.scrollY > 420;
      if (shouldShow !== show) {
        show = shouldShow;
        setShowBar(shouldShow);
      }
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    onScroll();
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  const goStart = () => navigate(user ? '/app/dashboard' : '/login');

  return (
    <>
      <section className="final-cta">
        <div className="container">
          <h2 className="h2-serif">{title}</h2>
          <p>{description}</p>
          <div className="hero-cta">
            <Button size="lg" onClick={goStart}>
              {primaryText}
            </Button>
            {secondaryText && secondaryTo && (
              <Button variant="ghost" size="lg" onClick={() => navigate(secondaryTo)}>
                {secondaryText}
              </Button>
            )}
          </div>
          <p className="hero-note">{note}</p>
        </div>
      </section>

      <div className={`mobile-cta-bar${showBar ? ' show' : ''}`}>
        <Button onClick={goStart}>{primaryText}</Button>
      </div>
    </>
  );
}
