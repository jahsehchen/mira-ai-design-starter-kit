interface ProgressBarProps {
  progress: number;
  statusText: string;
  detail?: string;
}

/** 导出进度条：百分比 + 阶段文案（真实回传，非伪造） */
export function ProgressBar({ progress, statusText, detail }: ProgressBarProps) {
  const clamped = Math.max(0, Math.min(100, progress));
  return (
    <div className="progress-wrap">
      <div className="progress-bar">
        <div className="progress-fill" style={{ width: `${clamped}%` }} />
      </div>
      <div className="progress-text">
        <span>{statusText}</span>
        <span>{detail ?? `${Math.floor(clamped)}%`}</span>
      </div>
    </div>
  );
}
