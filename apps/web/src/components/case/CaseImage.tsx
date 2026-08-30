/**
 * MIRA·弥画 案例图组件（仓库自有本地演示素材）
 *
 * 网格和详情都只读取 /images/demo 下的本地 SVG。详情保留骨架与淡入，
 * 加载失败时显示稳定占位，不向任何第三方地址发起回退请求。
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  getCaseDetailImageCandidates,
  getCaseImageCandidates,
  type CaseImageLike,
} from '../../utils/caseImageUrl';

export interface CaseImageProps {
  /** 案例对象（cases.json 的 CaseItem，含 image 字段） */
  caseItem: CaseImageLike;
  /** 图片 alt / 占位文案 */
  alt?: string;
  /** 透传给 <img> 的 className（占位时同样应用，保证尺寸一致） */
  className?: string;
  /** 加载策略：网格 lazy（现状保持），详情 eager */
  loading?: 'lazy' | 'eager';
  /** 详情模式：渲染骨架 + 淡入；默认 false 为网格模式 */
  preferHighRes?: boolean;
}

export default function CaseImage({
  caseItem,
  alt = '',
  className,
  loading = 'lazy',
  preferHighRes = false,
}: CaseImageProps) {
  const candidates = useMemo(
    () => (preferHighRes ? getCaseDetailImageCandidates(caseItem) : getCaseImageCandidates(caseItem)),
    [caseItem, preferHighRes],
  );
  const [index, setIndex] = useState(0);
  // 网格直出（无骨架）；详情先骨架，onLoad 后淡入
  const [loaded, setLoaded] = useState(!preferHighRes);

  // caseItem 变化（如详情面板切换案例）时重置回退进度，避免沿用上一个案例的失败态
  const prevImageRef = useRef<string | null>(null);
  if (prevImageRef.current !== caseItem.image) {
    prevImageRef.current = caseItem.image;
    setIndex(0);
    if (preferHighRes) setLoaded(false);
  }

  const failedAll = candidates.length === 0 || index >= candidates.length;

  const handleError = useCallback(() => {
    setIndex((prev) => (prev < candidates.length ? prev + 1 : prev));
  }, [candidates.length]);

  const handleLoad = useCallback(() => {
    setLoaded(true);
  }, []);

  // 兜底：图片已在缓存中（onLoad 早于 React 挂载）时，complete 检查补一次淡入
  const imgRef = useRef<HTMLImageElement | null>(null);
  useEffect(() => {
    if (preferHighRes && imgRef.current && imgRef.current.complete && imgRef.current.naturalWidth > 0) {
      setLoaded(true);
    }
  }, [preferHighRes, index, candidates]);

  // ---------- 网格渲染路径 ----------
  if (!preferHighRes) {
    if (failedAll) {
      return (
        <span
          className={className ? `${className} case-img-placeholder` : 'case-img-placeholder'}
          role="img"
          aria-label={alt}
        >
          {alt}
        </span>
      );
    }

    return (
      <img
        className={className}
        src={candidates[index]}
        alt={alt}
        loading={loading}
        onError={handleError}
      />
    );
  }

  // ---------- 详情模式：骨架 → 淡入；失败时占位 ----------
  return (
    <div className="case-detail-img-wrap" aria-busy={!loaded && !failedAll}>
      {!loaded && !failedAll && (
        <div className="skeleton case-detail-img-skeleton" aria-hidden="true" />
      )}
      {failedAll ? (
        <span
          className={className ? `${className} case-img-placeholder` : 'case-img-placeholder'}
          role="img"
          aria-label={alt}
        >
          {alt}
        </span>
      ) : (
        <img
          ref={imgRef}
          className={`${className ?? ''}${loaded ? ' is-loaded' : ''}`.trim()}
          src={candidates[index]}
          alt={alt}
          loading={loading}
          onLoad={handleLoad}
          onError={handleError}
        />
      )}
    </div>
  );
}
