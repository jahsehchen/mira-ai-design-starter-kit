import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import CaseImage from '../case/CaseImage';
import './landing.css';

interface CaseCardProps {
  /** cases.json 案例对象（含本地 image 字段） */
  caseItem: { image: string; title?: string; prompt?: string };
  title: string;
  meta: string;
  tag: string;
}

/** 首页案例卡（仓库自有演示图，链接到案例页） */
export function CaseCard({ caseItem, title, meta, tag }: CaseCardProps) {
  return (
    <Link className="case-card" to="/cases">
      <div className="case-thumb">
        <CaseImage caseItem={caseItem} alt={title} className="case-thumb-img" loading="lazy" />
        <span className="p-tag">{tag}</span>
      </div>
      <div className="case-meta">
        <b>{title}</b>
        <span>{meta}</span>
      </div>
    </Link>
  );
}

interface FeatureCardProps {
  icon: ReactNode;
  title: string;
  description: string;
  linkText: string;
  linkTo: string;
}

/** 首页核心功能卡 */
export function FeatureCard({ icon, title, description, linkText, linkTo }: FeatureCardProps) {
  return (
    <div className="feat-card">
      <div className="feat-icon">{icon}</div>
      <h3>{title}</h3>
      <p>{description}</p>
      <Link className="feat-link" to={linkTo}>
        {linkText}
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M5 12h14M13 6l6 6-6 6" />
        </svg>
      </Link>
    </div>
  );
}

interface FeatureBlockProps {
  number: string;
  title: string;
  description: string;
  scene: { label: string; text: ReactNode };
  ctaText: string;
  ctaTo: string;
  secondaryCta?: { text: string; to: string };
  reverse?: boolean;
  visual: ReactNode;
}

/** 功能页左右交替模块 */
export function FeatureBlock({
  number,
  title,
  description,
  scene,
  ctaText,
  ctaTo,
  secondaryCta,
  reverse = false,
  visual,
}: FeatureBlockProps) {
  return (
    <article className={`feat-module${reverse ? ' rev' : ''}`}>
      <div>
        <div className="fm-num">{number}</div>
        <h3>{title}</h3>
        <p className="fm-desc">{description}</p>
        <div className="fm-scene">
          <b>{scene.label}</b>
          <p>{scene.text}</p>
        </div>
        <div className="fm-cta">
          <Link className="btn btn-primary" to={ctaTo}>
            {ctaText}
          </Link>
          {secondaryCta && (
            <Link className="btn btn-ghost" to={secondaryCta.to}>
              {secondaryCta.text}
            </Link>
          )}
        </div>
      </div>
      <div className="fm-visual">{visual}</div>
    </article>
  );
}
