/**
 * Repository-owned demo case image resolution.
 *
 * Public builds only use local SVG assets under /images/demo. No case image
 * request falls back to a third-party CDN or remote repository.
 */
export interface CaseImageLike {
  image: string;
}

const LOCAL_DEMO_IMAGE_RE = /^\/images\/demo\/[a-z0-9-]+\.svg$/i;

export function localCaseImageUrl(c: CaseImageLike): string | null {
  return LOCAL_DEMO_IMAGE_RE.test(c.image) ? c.image : null;
}

export function getCaseImageCandidates(c: CaseImageLike): string[] {
  const local = localCaseImageUrl(c);
  return local ? [local] : [];
}

export function getCaseDetailImageCandidates(c: CaseImageLike): string[] {
  return getCaseImageCandidates(c);
}
