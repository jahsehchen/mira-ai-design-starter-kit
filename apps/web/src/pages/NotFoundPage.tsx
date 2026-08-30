import { Link } from 'react-router-dom';
import { Button } from '../components/ui/Button';

/** 404 页 */
export default function NotFoundPage() {
  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'var(--color-bg-page)',
        padding: 24,
        textAlign: 'center',
      }}
    >
      <div
        style={{
          width: 80,
          height: 80,
          borderRadius: '50%',
          background: 'var(--color-accent-100)',
          color: 'var(--color-accent-600)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          marginBottom: 20,
          fontSize: 28,
          fontWeight: 600,
        }}
      >
        404
      </div>
      <h1 style={{ fontSize: 20, fontWeight: 600, color: 'var(--color-text-display)' }}>这个页面不存在</h1>
      <p style={{ fontSize: 14, color: 'var(--color-text-secondary)', margin: '8px 0 24px' }}>
        可能链接有误，或者页面已经搬家了
      </p>
      <Link to="/">
        <Button>回到首页</Button>
      </Link>
    </div>
  );
}
