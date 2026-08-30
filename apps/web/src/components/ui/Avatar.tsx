interface AvatarProps {
  name: string;
  src?: string | null;
  size?: 'md' | 'lg';
}

/** 头像：中性色底 + 首字母；有 src 则显示图片 */
export function Avatar({ name, src, size = 'md' }: AvatarProps) {
  const initial = (name || '?').trim().charAt(0).toUpperCase();
  if (src) {
    return (
      <span className={`avatar${size === 'lg' ? ' avatar-lg' : ''}`}>
        <img src={src} alt={name} />
      </span>
    );
  }
  return <span className={`avatar${size === 'lg' ? ' avatar-lg' : ''}`}>{initial}</span>;
}
