import { Link } from 'react-router-dom';
import { SITE } from '../../config';
import './landing.css';

/** 落地页页脚：品牌 + 四列链接 + 页尾「logoMark」字品牌叙事（P2-03） */
export function LandingFooter() {
  return (
    <footer className="site-footer">
      <div className="container">
        <div className="footer-top">
          <div className="footer-brand">
            <Link to="/" className="logo">
              <span className="logo-mark">{SITE.logoMark}</span>
              <span>{SITE.companyName}</span>
            </Link>
            <p>让每个人都能把想法变成看得见的作品。</p>
            <div className="footer-sign" aria-label="品牌标语">
              {SITE.logoMark}·画
              <small>弥合想法与作品之间的距离，让好设计人人可得。</small>
            </div>
          </div>
          <div className="footer-cols">
            <div className="footer-col">
              <h4>产品</h4>
              <Link to="/features">功能</Link>
              <Link to="/login">开始创作</Link>
              <Link to="/pricing">定价</Link>
              <Link to="/cases">案例</Link>
            </div>
            <div className="footer-col">
              <h4>帮助</h4>
              <Link to="/pricing#faq">常见问题</Link>
              <Link to="/login">使用指南</Link>
              <Link to="/login">联系支持</Link>
            </div>
            <div className="footer-col">
              <h4>公司</h4>
              <Link to="/">关于我们</Link>
              <Link to="/">加入我们</Link>
              <Link to="/">媒体报道</Link>
            </div>
            <div className="footer-col">
              <h4>法律</h4>
              <Link to="/">隐私政策</Link>
              <Link to="/">服务条款</Link>
              <Link to="/">内容规范</Link>
            </div>
          </div>
        </div>
        <div className="footer-bottom">
          <span>© {SITE.copyrightYear} {SITE.companyName}</span>
          <Link to="/">回到顶部</Link>
        </div>
      </div>
    </footer>
  );
}
